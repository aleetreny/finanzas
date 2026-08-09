import { describe, expect, it } from "vitest";
import { messageFrom } from "@/components/finance-provider";

describe("mensajes de errores de acceso", () => {
  it("muestra errores claros para la clave y los límites de acceso", () => {
    expect(messageFrom(new Error("Invalid login credentials"))).toContain("correo o la clave");
    expect(messageFrom(new Error("rate limit exceeded"))).toContain("un minuto");
  });
});
