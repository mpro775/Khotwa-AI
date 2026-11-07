import { connect as connectTcp, isIP, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";

export interface LoginMessage {
  to: string;
  code: string;
  expiresMinutes: number;
}
export interface AccountMail {
  sendLogin(message: LoginMessage): Promise<void>;
}
/** Deliberately has no HTTP route and never prints a code or email. */
export class CapturedAccountMail implements AccountMail {
  private messages: LoginMessage[] = [];
  async sendLogin(message: LoginMessage): Promise<void> {
    if (this.messages.length >= 100) this.messages.shift();
    this.messages.push({ ...message });
  }
  takeForTesting(): LoginMessage | undefined {
    return this.messages.shift();
  }
}
export class DisabledAccountMail implements AccountMail {
  async sendLogin(): Promise<void> {
    throw new Error("ACCOUNT_MAIL_NOT_CONFIGURED");
  }
}
type SmtpSettings = {
  host: string;
  port: number;
  from: string;
  implicitTls: boolean;
  username?: string;
  password?: string;
  allowLocalPlaintext?: boolean;
};
/** Small SMTP client: implicit TLS in real deployments; plaintext only to the
 * explicitly configured local Mailpit service. No STARTTLS downgrade. */
export class SmtpAccountMail implements AccountMail {
  constructor(readonly settings: SmtpSettings) {
    const hostIsValid =
      settings.host.length > 0 &&
      settings.host.length <= 253 &&
      settings.host === settings.host.trim() &&
      (isIP(settings.host) !== 0 ||
        settings.host
          .split(".")
          .every((label) =>
            /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
          ));
    if (
      !hostIsValid ||
      !Number.isInteger(settings.port) ||
      settings.port < 1 ||
      settings.port > 65535 ||
      !/^[^\s<>@]+@[^\s<>@]+$/.test(settings.from) ||
      (!settings.implicitTls &&
        !(
          settings.allowLocalPlaintext &&
          ["localhost", "127.0.0.1", "::1", "mailpit"].includes(settings.host)
        ))
    )
      throw new Error("INVALID_SMTP_CONFIGURATION");
  }
  async sendLogin(message: LoginMessage): Promise<void> {
    if (
      !/^[^\s<>@]+@[^\s<>@]+$/.test(message.to) ||
      !/^\d{6}$/.test(message.code)
    )
      throw new Error("INVALID_MAIL_MESSAGE");
    const socket: Socket | TLSSocket = this.settings.implicitTls
      ? connectTls({
          host: this.settings.host,
          port: this.settings.port,
          servername: this.settings.host,
          rejectUnauthorized: true,
        })
      : connectTcp({ host: this.settings.host, port: this.settings.port });
    let buffered = "";
    let waiter: {
      resolve: (code: number) => void;
      reject: (error: Error) => void;
    } | null = null;
    const consume = () => {
      if (!waiter) return;
      const lines = buffered.split("\r\n");
      const last = lines.findIndex(
        (line, index) => index < lines.length - 1 && /^\d{3} /.test(line),
      );
      if (last < 0) return;
      const code = Number(lines[last]!.slice(0, 3));
      buffered = lines.slice(last + 1).join("\r\n");
      const pending = waiter;
      waiter = null;
      pending.resolve(code);
    };
    const reply = () =>
      new Promise<number>((resolve, reject) => {
        waiter = { resolve, reject };
        consume();
      });
    const expect = async (allowed: number[], command?: string) => {
      const waiting = reply();
      if (command !== undefined) socket.write(command + "\r\n");
      if (!allowed.includes(await waiting))
        throw new Error("SMTP_DELIVERY_FAILED");
    };
    const failure = () => {
      waiter?.reject(new Error("SMTP_DELIVERY_FAILED"));
      waiter = null;
      socket.destroy();
    };
    socket.setEncoding("utf8");
    socket.setTimeout(10000, failure);
    socket.on("error", failure);
    socket.on("close", () =>
      waiter?.reject(new Error("SMTP_CONNECTION_CLOSED")),
    );
    socket.on("data", (data: string) => {
      buffered += data;
      if (buffered.length > 16384) {
        failure();
        return;
      }
      consume();
    });
    try {
      await expect([220]);
      await expect([250], "EHLO khotwa.local");
      if (this.settings.username) {
        if (!this.settings.implicitTls || !this.settings.password)
          throw new Error("SMTP_TLS_REQUIRED");
        const credential = Buffer.from(
          "\0" + this.settings.username + "\0" + this.settings.password,
        ).toString("base64");
        await expect([235], "AUTH PLAIN " + credential);
      }
      await expect([250], "MAIL FROM:<" + this.settings.from + ">");
      await expect([250, 251], "RCPT TO:<" + message.to + ">");
      await expect([354], "DATA");
      const body = Buffer.from(
        "رمز الدخول إلى خُطوة: " +
          message.code +
          "\nصالح لمدة " +
          message.expiresMinutes +
          " دقائق. لا تشارك الرمز مع أحد.",
        "utf8",
      ).toString("base64");
      await expect(
        [250],
        [
          "From: <" + this.settings.from + ">",
          "To: <" + message.to + ">",
          "Subject: Khotwa login verification",
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=UTF-8",
          "Content-Transfer-Encoding: base64",
          "",
          body,
          ".",
        ].join("\r\n"),
      );
      await expect([221], "QUIT");
    } finally {
      socket.destroy();
    }
  }
}
export function accountMailFromEnvironment(): AccountMail {
  if (process.env.ACCOUNT_MAIL_MODE === "capture") {
    if (
      process.env.KHOTWA_SYNTHETIC_DATA !== "true" ||
      process.env.NODE_ENV === "production"
    )
      throw new Error("CAPTURE_MAIL_REQUIRES_LOCAL_SYNTHETIC_MODE");
    return new CapturedAccountMail();
  }
  if (process.env.ACCOUNT_MAIL_MODE !== "smtp")
    return new DisabledAccountMail();
  return new SmtpAccountMail({
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? "465"),
    from: process.env.SMTP_FROM ?? "",
    implicitTls: process.env.SMTP_IMPLICIT_TLS !== "false",
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    allowLocalPlaintext: process.env.SMTP_ALLOW_LOCAL_PLAINTEXT === "true",
  });
}
