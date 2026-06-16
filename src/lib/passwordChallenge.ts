import { getPasswordChallenge } from "@/services/api";
import type { PasswordChallenge, PasswordStatus } from "@/types";

type PasswordStatusSource = {
  passwordStatus?: PasswordStatus | null;
  password_status?: PasswordStatus | null;
  senhaExpirada?: boolean;
  senha_expirada?: boolean;
  precisaTrocarSenha?: boolean;
  precisa_trocar_senha?: boolean;
};

export function resolvePasswordStatus(source?: PasswordStatusSource | null): PasswordStatus | null {
  if (!source) return null;
  return (
    source.passwordStatus ??
    source.password_status ??
    (source.senhaExpirada || source.senha_expirada ? "expired" : null) ??
    (source.precisaTrocarSenha || source.precisa_trocar_senha ? "first_access" : null)
  );
}

export function extractPasswordChallenge(error: unknown): PasswordChallenge | null {
  return getPasswordChallenge(error);
}

export function passwordChallengeMessage(status: PasswordStatus) {
  return status === "expired"
    ? "Sua senha venceu. Troque-a para continuar."
    : "Primeiro acesso detectado. Crie uma nova senha.";
}
