import type { InventoryCurrentItem, SystemUser } from "@/types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function compactDigits(value: string) {
  return value.replace(/\D/g, "");
}

function scoreText(query: string, value: string) {
  const q = normalizeSearch(query);
  const v = normalizeSearch(value);
  if (!q || !v) return 0;
  if (v === q) return 100;
  if (v.startsWith(q)) return 80;
  if (v.includes(q)) return 50;
  return 0;
}

function scoreDigits(query: string, value: string) {
  const q = compactDigits(query);
  const v = compactDigits(value);
  if (!q || !v) return 0;
  if (v === q) return 110;
  if (v.startsWith(q)) return 90;
  if (v.includes(q)) return 60;
  return 0;
}

export function canRunGlobalSearch(query: string) {
  const normalized = normalizeSearch(query);
  return normalized.length >= 2 || compactDigits(query).length >= 1;
}

export function searchProducts(
  query: string,
  products: InventoryCurrentItem[],
  limit = 6,
): InventoryCurrentItem[] {
  if (!canRunGlobalSearch(query)) return [];

  return products
    .map((product) => ({
      product,
      score: Math.max(
        scoreText(query, product.productName),
        scoreDigits(query, product.barcode),
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.product.productName.localeCompare(b.product.productName))
    .slice(0, limit)
    .map((item) => item.product);
}

export function searchUsers(query: string, users: SystemUser[], limit = 6): SystemUser[] {
  if (!canRunGlobalSearch(query)) return [];

  return users
    .map((user) => ({
      user,
      score: Math.max(scoreText(query, user.name), scoreDigits(query, user.matricula)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name))
    .slice(0, limit)
    .map((item) => item.user);
}
