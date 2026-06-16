import { describe, expect, it } from "vitest";
import { passwordChallengeMessage, resolvePasswordStatus } from "./passwordChallenge";

describe("passwordChallenge", () => {
  it("resolves password status aliases", () => {
    expect(resolvePasswordStatus({ senhaExpirada: true })).toBe("expired");
    expect(resolvePasswordStatus({ precisa_trocar_senha: true })).toBe("first_access");
    expect(resolvePasswordStatus({ password_status: "expired" })).toBe("expired");
  });

  it("returns user-facing messages by status", () => {
    expect(passwordChallengeMessage("expired")).toContain("venceu");
    expect(passwordChallengeMessage("first_access")).toContain("Primeiro acesso");
  });
});
