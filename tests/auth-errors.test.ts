import { describe, expect, it } from "vitest";
import { messageFrom } from "@/components/finance-provider";

describe("mensajes de errores de acceso", () => {
  it("distingue el límite horario del intervalo corto entre envíos", () => {
    const hourlyLimit = Object.assign(new Error("email rate limit exceeded"), {
      code: "over_email_send_rate_limit",
    });

    expect(messageFrom(hourlyLimit)).toContain("dos correos permitidos en esta hora");
    expect(messageFrom(new Error("rate limit exceeded"))).toContain("60 segundos");
  });
});
