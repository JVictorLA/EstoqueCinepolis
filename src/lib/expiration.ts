const DAY_MS = 24 * 60 * 60 * 1000;

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
  const date = parseDateOnly(value);
  if (!date) return false;
  return date < startOfToday();
}

export function isNearExpiration(value?: string | null) {
  const date = parseDateOnly(value);
  if (!date || isExpired(value)) return false;
  const diffDays = Math.ceil((date.getTime() - startOfToday().getTime()) / DAY_MS);
  return diffDays <= 7;
}
