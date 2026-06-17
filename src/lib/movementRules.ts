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
