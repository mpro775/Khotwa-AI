import { timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  OnModuleDestroy,
  Req,
  UseGuards,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Pool } from "pg";
import type { HealthEnvelope } from "@khotwa/contracts";
import { metadata, RequestContext } from "./http";
@Injectable()
export class HealthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestContext>();
    const header = request.headers.authorization;
    const expected = process.env.INTERNAL_HEALTH_TOKEN ?? "";
    const actual =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : "";
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    if (b.length < 32 || a.length !== b.length || !timingSafeEqual(a, b))
      throw new ForbiddenException();
    return true;
  }
}
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly pool: Pool | null = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 1500,
        query_timeout: 1500,
      })
    : null;
  constructor() {
    this.pool?.on("error", () =>
      console.warn("Database connection unavailable."),
    );
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
  async dependencies(): Promise<HealthEnvelope["data"]["dependencies"]> {
    const postgres = async () => {
      if (!this.pool) return false;
      await this.pool.query("SELECT 1");
      if (process.env.PH04_API_ENABLED === "true")
        await this.pool.query("SELECT id FROM verification_reports LIMIT 0");
      if (process.env.PH06_API_ENABLED === "true")
        await this.pool.query("SELECT id FROM current_diagnoses LIMIT 0");
      if (process.env.PH07_API_ENABLED === "true")
        await this.pool.query("SELECT id FROM tutoring_events LIMIT 0");
      return true;
    };
    const math = async () => {
      const base = process.env.MATH_ENGINE_BASE_URL;
      const token = process.env.MATH_INTERNAL_TOKEN;
      if (!base || !token) return false;
      const r = await fetch(new URL("/internal/health", base), {
        headers: { authorization: "Bearer " + token },
        signal: AbortSignal.timeout(1500),
      });
      if (!r.ok) return false;
      const data: unknown = await r.json();
      return (
        typeof data === "object" &&
        data !== null &&
        "status" in data &&
        data.status === "ok"
      );
    };
    const values = await Promise.allSettled([postgres(), math()]);
    return ["postgresql", "math-engine"].map((name, index) => ({
      name,
      state:
        values[index]?.status === "fulfilled" && values[index].value === true
          ? "ok"
          : "unavailable",
    }));
  }
}
@Controller("internal/health")
@UseGuards(HealthGuard)
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Get("live") live(@Req() request: RequestContext): HealthEnvelope {
    return {
      data: {
        status: "ok",
        service: "khotwa-api",
        time: new Date().toISOString(),
        dependencies: [],
      },
      meta: metadata(request),
    };
  }
  @Get("ready") async ready(
    @Req() request: RequestContext,
  ): Promise<HealthEnvelope> {
    const dependencies = await this.health.dependencies();
    const ok = dependencies.every((d) => d.state === "ok");
    if (!ok) throw new ServiceUnavailableException();
    return {
      data: {
        status: "ok",
        service: "khotwa-api",
        time: new Date().toISOString(),
        dependencies,
      },
      meta: metadata(request),
    };
  }
}
