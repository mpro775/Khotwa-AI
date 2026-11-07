import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  HttpCode,
  Put,
  Query,
  Req,
  Res,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { input, idempotencyHeader, Schema, uuid } from "./contracts";
import { ApiFault, metadata, RequestContext, ResponseContext } from "./http";
import { Security, secureCookie } from "./security";
import { GuestAuth, guestDto, MutationResult, Store } from "./store";
import { MathGateway } from "./math-gateway";
import { DisabledAiAdapter } from "./ai-port";
import { VerificationService } from "./verification";
import { DiagnosisService } from "./diagnosis";
import { TutoringService, TutoringLimits } from "./tutoring";
import { NoExternalAi } from "./ai-tutor";
import { ph08TutoringFromEnvironment } from "./ph08-gemini";
import { LearningService } from "./learning";
import { ProgressService } from "./progress";
import { TeacherDemoService } from "./teacher-demo";
import { AccountService, AccountsController } from "./accounts";
import { BetaController, BetaOperationsService } from "./beta-operations";
import {
  ContentStudioController,
  ContentStudioService,
} from "./content-studio";
import { PhysicsController, PhysicsService } from "./physics";
import { ProgrammingController, ProgrammingService } from "./programming";
import { Judge0Runner, runnerFromEnvironment } from "./programming-runner";
import {
  LearningPathContentController,
  LearningPathContentService,
} from "./learning-path-content";
import {
  LearningAssessmentController,
  LearningAssessmentService,
} from "./learning-assessments";

type AccessMode = "bootstrap" | "createGuest" | "current" | "logout";
const Access = (mode: AccessMode) => SetMetadata("access", mode);
interface SessionRequest extends RequestContext {
  auth?: GuestAuth;
  idempotencyKey?: string;
}
const required = (value: string | undefined): string => {
  if (!value) throw new Error("Missing PH-04 configuration");
  return value;
};
const numberSetting = (value: string | undefined): number => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new Error("Explicit positive PH-04 limit required");
  return n;
};
export function securityFromEnvironment(): Security {
  return new Security({
    origin: required(process.env.PUBLIC_APP_ORIGIN),
    digestKey: required(process.env.GUEST_DIGEST_KEY),
    bootstrapKey: required(process.env.BOOTSTRAP_SIGNING_KEY),
    csrfKey: required(process.env.CSRF_SIGNING_KEY),
    issueKey: required(process.env.GUEST_ISSUE_KEY),
    idempotencyKey: required(process.env.IDEMPOTENCY_DIGEST_KEY),
    cursorKey: required(process.env.CURSOR_SIGNING_KEY),
    bootstrapSeconds: numberSetting(process.env.PH04_BOOTSTRAP_TTL_SECONDS),
  });
}
/** Bounded, process-local experimental limiter. Numeric policy and edge-wide
 * deployment review remain pending; no IP, user agent or raw token is stored. */
export class RequestLimits {
  private readonly buckets = new Map<string, { count: number; ends: number }>();
  constructor(
    readonly maximum: number,
    readonly windowSeconds: number,
  ) {}
  take(key: string, now = Date.now()): void {
    for (const [id, b] of this.buckets)
      if (b.ends <= now) this.buckets.delete(id);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 10000)
        throw new ApiFault(
          429,
          "rate_limited",
          "انتظر قليلًا ثم أعد المحاولة.",
          [],
          null,
          this.windowSeconds,
        );
      bucket = { count: 0, ends: now + this.windowSeconds * 1000 };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > this.maximum)
      throw new ApiFault(
        429,
        "rate_limited",
        "انتظر قليلًا ثم أعد المحاولة.",
        [],
        null,
        Math.max(1, Math.ceil((bucket.ends - now) / 1000)),
      );
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly store: Store,
    private readonly security: Security,
    private readonly limits: RequestLimits,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const mode = this.reflector.get<AccessMode | undefined>(
      "access",
      context.getHandler(),
    );
    const guest = await this.store.authenticate(request, {
      optional: mode === "bootstrap" || mode === "createGuest",
      current: mode === "current",
      logout: mode === "logout",
    });
    if (guest) request.auth = guest;
    if (process.env.BETA_ENABLED === "true" && mode === "createGuest" && !guest)
      throw new ApiFault(
        403,
        "forbidden",
        "سجل الدخول بحساب مدعو لاستخدام النسخة التجريبية.",
      );
    this.limits.take(guest ? guest.row.id : "anonymous");
    if (request.method !== "GET") {
      if (
        typeof request.headers["content-type"] !== "string" ||
        request.headers["content-type"].split(";")[0]?.trim().toLowerCase() !==
          "application/json"
      )
        throw new ApiFault(400, "invalid_input", "يجب إرسال الطلب بصيغة JSON.");
      const csrf = request.headers["x-csrf-token"];
      if (typeof csrf !== "string" || csrf.length < 32)
        throw new ApiFault(400, "invalid_input", "رأس حماية CSRF مطلوب.");
      this.security.checkOrigin(request);
      if (mode !== "createGuest") {
        if (!guest)
          throw new ApiFault(401, "unauthenticated", "ابدأ جلسة ضيف.");
        this.security.checkGuestCsrf(request, guest.token);
        request.idempotencyKey = idempotencyHeader(
          request.headers["idempotency-key"],
        );
      }
    }
    return true;
  }
}
const auth = (r: SessionRequest): GuestAuth => {
  if (!r.auth) throw new ApiFault(401, "unauthenticated", "ابدأ جلسة ضيف.");
  return r.auth;
};
const key = (r: SessionRequest): string => idempotencyHeader(r.idempotencyKey);
const envelope = <T>(request: RequestContext, data: T) => ({
  data,
  meta: metadata(request),
});
const mutation = <T>(
  request: RequestContext,
  response: ResponseContext,
  result: MutationResult<T>,
) => {
  response.status(result.status);
  return envelope(request, result.data);
};
function queryFields(query: Record<string, unknown>, names: string[]): void {
  if (
    Object.keys(query).some((k) => !names.includes(k)) ||
    Object.values(query).some((v) => typeof v !== "string")
  )
    throw new ApiFault(422, "invalid_input", "حقول الاستعلام غير صالحة.");
}
function pagination(query: Record<string, unknown>): number {
  if (query.limit === undefined) return 15;
  if (
    typeof query.limit !== "string" ||
    !/^\d{1,2}$/.test(query.limit) ||
    Number(query.limit) < 1 ||
    Number(query.limit) > 30
  )
    throw new ApiFault(422, "invalid_input", "حجم الصفحة بين ١ و٣٠.");
  return Number(query.limit);
}
function queryId(value: unknown): string {
  if (typeof value !== "string")
    throw new ApiFault(400, "invalid_input", "معرّف الاستعلام مطلوب.");
  return uuid(value);
}
const capabilities: Schema<"Capabilities"> = {
  notationProfile: "ar-mashriq-school-v1",
  subject: "algebra",
  variable: "س",
  mathModes: ["linear_one_variable"],
  supportsTrigonometry: false,
  supportsHandwriting: false,
  supportsFractions: false,
  supportsTeacherRealData: false,
  supportedMathStatuses: [
    "verified_valid",
    "verified_invalid",
    "syntax_error",
    "unsupported",
    "inconclusive",
    "service_error",
  ],
};

@Controller("api/v1")
@UseGuards(SessionGuard)
export class BusinessController {
  constructor(
    private readonly store: Store,
    private readonly security: Security,
    private readonly verification: VerificationService,
    private readonly diagnosis: DiagnosisService,
    private readonly tutoring: TutoringService,
    private readonly learningService: LearningService,
    private readonly progressService: ProgressService,
    private readonly teacherDemo: TeacherDemoService,
  ) {}
  @Get("bootstrap")
  @Access("bootstrap")
  bootstrap(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
  ): Schema<"BootstrapEnvelope"> {
    if (
      (request.headers.origin !== undefined &&
        request.headers.origin !== this.security.settings.origin) ||
      (request.headers["sec-fetch-site"] !== undefined &&
        !["same-origin", "none"].includes(
          String(request.headers["sec-fetch-site"]),
        ))
    )
      throw new ApiFault(
        400,
        "invalid_input",
        "التهيئة متاحة من أصل التطبيق فقط.",
      );
    const issued = this.security.bootstrap();
    response.setHeader(
      "Set-Cookie",
      secureCookie(
        "kh_bootstrap",
        issued.cookie,
        this.security.settings.bootstrapSeconds,
      ),
    );
    return envelope(request, {
      csrfToken: issued.csrf,
      csrfHeaderName: "X-CSRF-Token",
      capabilities,
      hasActiveGuestSession: !!request.auth,
    });
  }
  @Post("guest-sessions")
  @Access("createGuest")
  async createGuest(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Body() raw: unknown,
  ): Promise<Schema<"GuestEnvelope">> {
    input("CreateGuestInput", raw);
    let existingCsrf = false;
    if (request.auth) {
      try {
        this.security.checkGuestCsrf(request, request.auth.token);
        existingCsrf = true;
      } catch {
        /* Bootstrap token may be used to resume the current guest. */
      }
    }
    const nonce = existingCsrf ? null : this.security.bootstrapNonce(request);
    const result = request.auth
      ? { auth: request.auth, created: false }
      : await this.store.createGuest(nonce!);
    response.status(result.created ? 201 : 200);
    if (!result.auth.accountSessionId)
      response.setHeader(
        "Set-Cookie",
        secureCookie(
          "kh_guest",
          result.auth.token,
          (result.auth.row.expires_at.getTime() - Date.now()) / 1000,
        ),
      );
    return envelope(request, {
      session: guestDto(result.auth.row),
      csrfToken: this.security.guestCsrf(result.auth.token),
    });
  }
  @Get("guest-sessions/current")
  @Access("current")
  current(@Req() request: SessionRequest): Schema<"GuestCurrentEnvelope"> {
    return envelope(request, guestDto(auth(request).row));
  }
  @Get("attempts/:id/tutoring-plan")
  tutoringPlan(@Req() request: SessionRequest, @Param("id") id: string) {
    return this.tutoring
      .plan(auth(request), uuid(id))
      .then((data) => envelope(request, data));
  }
  @Get("attempts/:id/problem")
  async pinnedProblem(@Req() request: SessionRequest, @Param("id") id: string) {
    return envelope(
      request,
      await this.store.getAttemptProblem(auth(request), uuid(id)),
    );
  }
  @Delete("guest-sessions/current")
  @Access("logout")
  async revoke(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Body() raw: unknown,
  ): Promise<void> {
    if (raw !== undefined)
      throw new ApiFault(
        400,
        "invalid_input",
        "هذه العملية لا تقبل حمولة JSON.",
      );
    const result = await this.store.revoke(auth(request), key(request));
    response.setHeader("Set-Cookie", secureCookie("kh_guest", "", 0));
    response.status(result.status);
  }
  @Post("learning-sessions")
  async createLearning(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.store.createLearning(
        auth(request),
        key(request),
        input("CreateLearningSessionInput", raw),
      ),
    );
  }
  @Get("learning-sessions/:id")
  async learning(@Req() request: SessionRequest, @Param("id") id: string) {
    return envelope(
      request,
      await this.store.getLearning(auth(request), uuid(id)),
    );
  }
  @Get("skills")
  async skills(@Req() request: SessionRequest) {
    auth(request);
    return envelope(request, await this.store.listSkills());
  }
  @Get("skills/:id")
  async skill(@Req() request: SessionRequest, @Param("id") id: string) {
    auth(request);
    return envelope(request, await this.store.getSkill(uuid(id)));
  }
  @Get("problems")
  async problems(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ) {
    auth(request);
    queryFields(query, ["skillId", "limit", "cursor"]);
    const skill = queryId(query.skillId);
    const cursor = this.security.readCursor(query.cursor, "problems:" + skill);
    return envelope(
      request,
      await this.store.listProblems(
        skill,
        pagination(query),
        cursor ? uuid(cursor) : null,
      ),
    );
  }
  @Get("problems/:id")
  async problem(@Req() request: SessionRequest, @Param("id") id: string) {
    auth(request);
    return envelope(
      request,
      await this.store.getProblem(uuid(id), auth(request)),
    );
  }
  @Post("attempts")
  async createAttempt(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.store.createAttempt(
        auth(request),
        key(request),
        input("CreateAttemptInput", raw),
      ),
    );
  }
  @Get("attempts")
  async attempts(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const guest = auth(request);
    queryFields(query, ["learningSessionId", "limit", "cursor"]);
    const learning = queryId(query.learningSessionId);
    const cursor = this.security.readCursor(
      query.cursor,
      "attempts:" + guest.row.id + ":" + learning,
    );
    return envelope(
      request,
      await this.store.listAttempts(
        guest,
        learning,
        pagination(query),
        cursor ? uuid(cursor) : null,
      ),
    );
  }
  @Get("attempts/:id")
  async attempt(@Req() request: SessionRequest, @Param("id") id: string) {
    return envelope(
      request,
      await this.store.getAttempt(auth(request), uuid(id)),
    );
  }
  @Post("attempts/:id/steps")
  async addStep(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.store.changeStep(
        auth(request),
        key(request),
        uuid(id),
        "create",
        input("CreateStepInput", raw),
      ),
    );
  }
  @Post("attempts/:id/verify")
  @HttpCode(200)
  async verify(
    @Req() request: SessionRequest,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    if (process.env.PH05_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    return envelope(
      request,
      await this.verification.verify(
        auth(request),
        uuid(id),
        key(request),
        input("VerifyInput", raw),
      ),
    );
  }
  @Post("attempts/:id/hints")
  @HttpCode(200)
  async requestHint(
    @Req() request: SessionRequest,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    if (process.env.PH07_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    return envelope(
      request,
      await this.tutoring.request(
        auth(request),
        uuid(id),
        key(request),
        input("HintInput", raw),
      ),
    );
  }
  @Post("attempts/:id/remediation")
  async remediation(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.learningService.startRemediation(
        auth(request),
        uuid(id),
        key(request),
        input("StartRemediationInput", raw),
      ),
    );
  }
  @Post("attempts/:id/transfer")
  async transfer(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.learningService.startTransfer(
        auth(request),
        uuid(id),
        key(request),
        input("StartTransferInput", raw),
      ),
    );
  }
  @Get("learning-episodes/:id")
  async episode(@Req() request: SessionRequest, @Param("id") id: string) {
    return envelope(
      request,
      await this.learningService.get(auth(request), uuid(id)),
    );
  }
  @Get("progress")
  async progress(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ) {
    if (
      Object.keys(query).some((k) => k !== "learningSessionId") ||
      Object.values(query).some((v) => typeof v !== "string")
    )
      throw new ApiFault(
        400,
        "invalid_input",
        "حقول استعلام التقدم غير صالحة.",
      );
    return envelope(
      request,
      await (
        process.env.PH09_API_ENABLED === "true"
          ? this.progressService
          : this.learningService
      ).progress(auth(request), queryId(query.learningSessionId)),
    );
  }
  @Get("progress/skills/:id")
  async skillProgress(
    @Req() request: SessionRequest,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    if (
      Object.keys(query).some((k) => k !== "learningSessionId") ||
      Object.values(query).some((v) => typeof v !== "string")
    )
      throw new ApiFault(
        400,
        "invalid_input",
        "حقول استعلام التقدم غير صالحة.",
      );
    return envelope(
      request,
      (
        await (
          process.env.PH09_API_ENABLED === "true"
            ? this.progressService
            : this.learningService
        ).progress(auth(request), queryId(query.learningSessionId), uuid(id))
      ).skills[0],
    );
  }
  @Get("teacher-demo/summary")
  async teacherSummary(
    @Req() request: SessionRequest,
    @Query() query: Record<string, unknown>,
  ) {
    auth(request);
    if (Object.keys(query).length)
      throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return envelope(request, this.teacherDemo.summary());
  }
  @Get("teacher-demo/examples/:id")
  async teacherExample(
    @Req() request: SessionRequest,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    auth(request);
    if (Object.keys(query).length)
      throw new ApiFault(404, "not_found", "المورد غير متاح.");
    return envelope(request, this.teacherDemo.example(id));
  }
  @Post("attempts/:id/probes")
  async createProbe(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Body() raw: unknown,
  ) {
    if (process.env.PH06_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    return mutation(
      request,
      response,
      await this.diagnosis.createProbe(
        auth(request),
        uuid(id),
        key(request),
        input("RequestProbeInput", raw),
      ),
    );
  }
  @Post("attempts/:id/probes/:probeId/responses")
  async answerProbe(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Param("probeId") probeId: string,
    @Body() raw: unknown,
  ) {
    if (process.env.PH06_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    return mutation(
      request,
      response,
      await this.diagnosis.answerProbe(
        auth(request),
        uuid(id),
        uuid(probeId),
        key(request),
        input("AnswerProbeInput", raw),
      ),
    );
  }
  @Get("attempts/:id/verifications/:resultId")
  async verificationDetail(
    @Req() request: SessionRequest,
    @Param("id") id: string,
    @Param("resultId") resultId: string,
  ) {
    if (process.env.PH05_API_ENABLED !== "true")
      throw new ApiFault(404, "not_found", "المسار غير متاح في هذه النسخة.");
    return envelope(
      request,
      await this.verification.detail(auth(request), uuid(id), uuid(resultId)),
    );
  }
  @Put("attempts/:id/steps/:stepId")
  async editStep(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Param("stepId") stepId: string,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.store.changeStep(
        auth(request),
        key(request),
        uuid(id),
        "edit",
        input("EditStepInput", raw),
        uuid(stepId),
      ),
    );
  }
  @Delete("attempts/:id/steps/:stepId")
  async deleteStep(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: ResponseContext,
    @Param("id") id: string,
    @Param("stepId") stepId: string,
    @Body() raw: unknown,
  ) {
    return mutation(
      request,
      response,
      await this.store.changeStep(
        auth(request),
        key(request),
        uuid(id),
        "delete",
        input("DeleteStepInput", raw),
        uuid(stepId),
      ),
    );
  }
}
@Module({
  controllers: [
    BusinessController,
    AccountsController,
    BetaController,
    ContentStudioController,
    PhysicsController,
    ProgrammingController,
    LearningPathContentController,
    LearningAssessmentController,
  ],
  providers: [
    { provide: Security, useFactory: securityFromEnvironment },
    {
      provide: Store,
      useFactory: (security: Security) =>
        new Store(
          security,
          required(process.env.DATABASE_URL),
          process.env.KHOTWA_SYNTHETIC_DATA === "true",
        ),
      inject: [Security],
    },
    {
      provide: RequestLimits,
      useFactory: () =>
        new RequestLimits(
          numberSetting(process.env.PH04_RATE_LIMIT_MAX),
          numberSetting(process.env.PH04_RATE_LIMIT_WINDOW_SECONDS),
        ),
    },
    {
      provide: AccountService,
      useFactory: (store: Store) => new AccountService(store),
      inject: [Store],
    },
    {
      provide: BetaOperationsService,
      useFactory: (store: Store, accounts: AccountService) =>
        new BetaOperationsService(store, accounts),
      inject: [Store, AccountService],
    },
    { provide: Judge0Runner, useFactory: runnerFromEnvironment },
    {
      provide: ContentStudioService,
      useFactory: (
        store: Store,
        accounts: AccountService,
        math: MathGateway,
        runner: Judge0Runner,
      ) => new ContentStudioService(store, accounts, math, runner),
      inject: [Store, AccountService, MathGateway, Judge0Runner],
    },
    {
      provide: PhysicsService,
      useFactory: (store: Store, accounts: AccountService) =>
        new PhysicsService(store, accounts),
      inject: [Store, AccountService],
    },
    {
      provide: LearningPathContentService,
      useFactory: (
        store: Store,
        accounts: AccountService,
        math: MathGateway,
        studio: ContentStudioService,
      ) => new LearningPathContentService(store, accounts, math, studio),
      inject: [Store, AccountService, MathGateway, ContentStudioService],
    },
    {
      provide: LearningAssessmentService,
      useFactory: (
        store: Store,
        accounts: AccountService,
        content: LearningPathContentService,
        verification: VerificationService,
        tutoring: TutoringService,
        physics: PhysicsService,
      ) =>
        new LearningAssessmentService(
          store,
          accounts,
          content,
          verification,
          tutoring,
          physics,
        ),
      inject: [
        Store,
        AccountService,
        LearningPathContentService,
        VerificationService,
        TutoringService,
        PhysicsService,
      ],
    },
    {
      provide: ProgrammingService,
      useFactory: (
        store: Store,
        accounts: AccountService,
        runner: Judge0Runner,
      ) => new ProgrammingService(store, accounts, runner),
      inject: [Store, AccountService, Judge0Runner],
    },
    {
      provide: MathGateway,
      useFactory: () =>
        new MathGateway({
          baseUrl: required(process.env.MATH_ENGINE_BASE_URL),
          token: required(process.env.MATH_INTERNAL_TOKEN),
          timeoutMs: numberSetting(process.env.PH04_MATH_TIMEOUT_MS),
          expectedEngine: "0.3.0",
        }),
    },
    DisabledAiAdapter,
    {
      provide: DiagnosisService,
      useFactory: (store: Store) =>
        new DiagnosisService(store, process.env.PH06_API_ENABLED === "true"),
      inject: [Store],
    },
    {
      provide: LearningService,
      useFactory: (store: Store) => {
        const active = process.env.PH08_API_ENABLED === "true";
        return new LearningService(
          store,
          active,
          active
            ? numberSetting(process.env.PH08_MAX_REMEDIATION_ASSIGNMENTS)
            : 2,
          active ? numberSetting(process.env.PH08_MAX_TRANSFER_ASSIGNMENTS) : 2,
        );
      },
      inject: [Store],
    },
    {
      provide: ProgressService,
      useFactory: (store: Store) =>
        new ProgressService(store, process.env.PH09_API_ENABLED === "true"),
      inject: [Store],
    },
    {
      provide: TeacherDemoService,
      useFactory: () =>
        new TeacherDemoService(process.env.PH09_API_ENABLED === "true"),
    },
    NoExternalAi,
    {
      provide: TutoringService,
      useFactory: (store: Store, math: MathGateway, ai: NoExternalAi) => {
        const active = process.env.PH07_API_ENABLED === "true";
        const limit = (name: string, fallback: number) =>
          active ? numberSetting(process.env[name]) : fallback;
        const limits: TutoringLimits = {
          requestTimeoutMs: limit("PH07_REQUEST_TIMEOUT_MS", 20000),
          aiTimeoutMs: limit("PH07_AI_TIMEOUT_MS", 500),
          maxInputBytes: limit("PH07_MAX_INPUT_BYTES", 4096),
          maxOutputTokens: limit("PH07_MAX_OUTPUT_TOKENS", 256),
          guestCalls: limit("PH07_GUEST_CALLS", 10),
          globalCalls: limit("PH07_GLOBAL_CALLS", 100),
          guestCostUnits: limit("PH07_GUEST_COST_UNITS", 100),
          globalCostUnits: limit("PH07_GLOBAL_COST_UNITS", 1000),
          maxParallel: limit("PH07_MAX_PARALLEL", 2),
        };
        return ph08TutoringFromEnvironment(store, math, ai, limits, active);
      },
      inject: [Store, MathGateway, NoExternalAi],
    },
    {
      provide: VerificationService,
      useFactory: (
        store: Store,
        math: MathGateway,
        diagnosis: DiagnosisService,
      ) =>
        new VerificationService(
          store,
          math,
          process.env.PH05_API_ENABLED === "true"
            ? numberSetting(process.env.PH05_VERIFY_TIMEOUT_MS)
            : 20000,
          diagnosis,
        ),
      inject: [Store, MathGateway, DiagnosisService],
    },
    SessionGuard,
  ],
  exports: [
    ProgressService,
    TeacherDemoService,
    LearningService,
    TutoringService,
    Store,
    MathGateway,
    DisabledAiAdapter,
    VerificationService,
    DiagnosisService,
  ],
})
export class BusinessModule {}
