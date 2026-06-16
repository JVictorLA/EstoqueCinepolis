import type { Product } from "@/types";

export interface WasteValidationInput {
  selectedEstoqueId: string;
  barcode: string;
  product: Product | null;
  reasonId: string;
  quantity: string;
  lot: string;
}

export function validateWaste(input: WasteValidationInput): { quantity: number } | { error: string } {
  if (!Number(input.selectedEstoqueId)) return { error: "Selecione o estoque" };
  if (!input.barcode.trim()) return { error: "Informe o codigo de barras" };
  if (!input.product) return { error: "Produto nao encontrado no estoque selecionado" };
  if (!Number(input.reasonId)) return { error: "Selecione o motivo" };
  if (input.product.requiresExpiration && !input.lot.trim()) return { error: "Informe o lote" };

  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return { error: "Informe uma quantidade valida" };
  if (quantity > input.product.stock) return { error: "Quantidade maior que o estoque atual" };

  return { quantity };
}
