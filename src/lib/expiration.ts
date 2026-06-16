const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpirationStatus =
  | "vencido"
  | "proximo_vencimento"
  | "validade_15"
  | "validade_30"
  | "ok"
  | "sem_validade";

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export function isExpired(value?: string | null) {
  return getExpirationStatus(value) === "vencido";
}

export function isNearExpiration(value?: string | null) {
  return getExpirationStatus(value) === "proximo_vencimento";
}

export function getExpirationStatus(value?: string | null): ExpirationStatus {
  const date = parseDateOnly(value);
  if (!date) return "sem_validade";

  const diffDays = Math.ceil((date.getTime() - startOfToday().getTime()) / DAY_MS);
  if (diffDays < 0) return "vencido";
  if (diffDays <= 7) return "proximo_vencimento";
  if (diffDays <= 15) return "validade_15";
  if (diffDays <= 30) return "validade_30";
  return "ok";
}
