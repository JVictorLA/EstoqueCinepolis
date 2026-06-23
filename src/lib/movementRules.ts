import type { Product } from "@/types";

export type MovementOperation = "saida" | "transferencia";

export interface MovementValidationInput {
  barcode: string;
  selectedEstoqueId: string;
  targetEstoqueId: string;
  operation: MovementOperation;
  quantity: string;
  product: Product | null;
  type: "entrada" | "saida";
  lot: string;
  expirationDate: string;
  matricula: string;
}

export interface TransferCartValidationItem {
  quantity: number | string;
  lot: string;
  maxQuantity?: number | null;
  product?: Pick<Product, "name" | "requiresExpiration"> | null;
}

export interface TransferCartValidationInput {
  selectedEstoqueId: string;
  targetEstoqueId: string;
  matricula: string;
  items: TransferCartValidationItem[];
}

export interface QuantityLimitLot {
  lot: string;
  quantity: number;
}

export interface QuantityLimitInput {
  product: Pick<Product, "stock"> | null;
  lots: QuantityLimitLot[];
  lot: string;
  type: "entrada" | "saida";
  operation: MovementOperation;
}

export function resolveQuantityLimit(input: QuantityLimitInput): number | null {
  if (!input.product || input.type === "entrada") return null;

  const trimmedLot = input.lot.trim().toLowerCase();
  if (trimmedLot) {
    const selectedLot = input.lots.find((item) => item.lot.trim().toLowerCase() === trimmedLot);
    if (selectedLot) return Math.max(0, Number(selectedLot.quantity) || 0);
  }

  return Math.max(0, Number(input.product.stock) || 0);
}

export function clampQuantityToLimit(
  quantity: string | number,
  limit: number | null,
): { value: string; changed: boolean } {
  const raw = String(quantity);
  if (limit === null || raw.trim() === "") return { value: raw, changed: false };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= limit) {
    return { value: raw, changed: false };
  }

  return { value: String(limit), changed: true };
}

export function validateTransferCart(input: TransferCartValidationInput): string | null {
  if (!input.selectedEstoqueId) return "Selecione o estoque";
  if (!input.targetEstoqueId) return "Selecione o estoque de destino";
  if (input.targetEstoqueId === input.selectedEstoqueId) {
    return "O destino precisa ser diferente da origem";
  }
  if (!input.items.length) return "Adicione pelo menos um produto";

  for (const [index, item] of input.items.entries()) {
    const label = item.product?.name || `item ${index + 1}`;
    if (!item.quantity || Number(item.quantity) <= 0) {
      return `Informe uma quantidade valida para ${label}`;
    }
    if (item.maxQuantity !== undefined && item.maxQuantity !== null && Number(item.quantity) > item.maxQuantity) {
      return "Saldo insuficiente neste estoque.";
    }
    if (item.product?.requiresExpiration && !item.lot.trim()) {
      return `Informe o lote para ${label}`;
    }
  }

  if (!input.matricula.trim()) return "Informe a matricula";
  return null;
}

export function validateMovement(input: MovementValidationInput): string | null {
  if (!input.barcode.trim()) return "Informe o código de barras";
  if (!input.selectedEstoqueId) return "Selecione o estoque";
  if (input.operation === "transferencia") {
    if (!input.targetEstoqueId) return "Selecione o estoque de destino";
    if (input.targetEstoqueId === input.selectedEstoqueId) {
      return "O destino precisa ser diferente da origem";
    }
  }
  if (!input.quantity || parseInt(input.quantity, 10) <= 0) return "Informe a quantidade";
  if (input.product?.requiresExpiration && !input.lot.trim()) return "Informe o lote";
  if (input.type === "entrada" && input.product?.requiresExpiration && !input.expirationDate) {
    return "Informe a validade do lote";
  }
  if (!input.matricula.trim()) return "Informe a matrícula";
  return null;
}
