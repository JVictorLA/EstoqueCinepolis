import { describe, expect, it } from "vitest";
import {
  clampQuantityToLimit,
  resolveQuantityLimit,
  validateMovement,
  validateTransferCart,
} from "./movementRules";

const base = {
  barcode: "789",
  selectedEstoqueId: "1",
  targetEstoqueId: "2",
  operation: "saida" as const,
  quantity: "1",
  product: null,
  type: "saida" as const,
  lot: "",
  expirationDate: "",
  matricula: "0001",
};

describe("movementRules", () => {
  it("accepts a complete movement", () => {
    expect(validateMovement(base)).toBeNull();
  });

  it("requires a different target stock for transfers", () => {
    expect(
      validateMovement({
        ...base,
        operation: "transferencia",
        targetEstoqueId: "1",
      }),
    ).toBe("O destino precisa ser diferente da origem");
  });

  it("requires at least one item in a transfer cart", () => {
    expect(
      validateTransferCart({
        selectedEstoqueId: "1",
        targetEstoqueId: "2",
        matricula: "0001",
        items: [],
      }),
    ).toBe("Adicione pelo menos um produto");
  });

  it("requires valid quantities in a transfer cart", () => {
    expect(
      validateTransferCart({
        selectedEstoqueId: "1",
        targetEstoqueId: "2",
        matricula: "0001",
        items: [{ quantity: 0, lot: "L1", product: { name: "Nachos", requiresExpiration: true } }],
      }),
    ).toBe("Informe uma quantidade valida para Nachos");
  });

  it("requires lot for batch transfer products that need expiration", () => {
    expect(
      validateTransferCart({
        selectedEstoqueId: "1",
        targetEstoqueId: "2",
        matricula: "0001",
        items: [{ quantity: 1, lot: "", product: { name: "Queijo", requiresExpiration: true } }],
      }),
    ).toBe("Informe o lote para Queijo");
  });

  it("requires a different target stock for transfer carts", () => {
    expect(
      validateTransferCart({
        selectedEstoqueId: "1",
        targetEstoqueId: "1",
        matricula: "0001",
        items: [{ quantity: 1, lot: "L1", product: { name: "Pipoca", requiresExpiration: true } }],
      }),
    ).toBe("O destino precisa ser diferente da origem");
  });

  it("uses product stock as the quantity limit for withdrawals", () => {
    expect(
      resolveQuantityLimit({
        product: { stock: 5 },
        lots: [],
        lot: "",
        type: "saida",
        operation: "saida",
      }),
    ).toBe(5);
  });

  it("uses selected lot stock as the quantity limit when lot matches exactly", () => {
    expect(
      resolveQuantityLimit({
        product: { stock: 10 },
        lots: [{ lot: "L1", quantity: 3 }],
        lot: "L1",
        type: "saida",
        operation: "transferencia",
      }),
    ).toBe(3);
  });

  it("does not limit entries by current stock", () => {
    expect(
      resolveQuantityLimit({
        product: { stock: 2 },
        lots: [{ lot: "L1", quantity: 1 }],
        lot: "L1",
        type: "entrada",
        operation: "saida",
      }),
    ).toBeNull();
  });

  it("clamps quantities above the available stock", () => {
    expect(clampQuantityToLimit("8", 5)).toEqual({ value: "5", changed: true });
  });

  it("keeps transfer cart item quantities inside the saved stock limit", () => {
    expect(clampQuantityToLimit(7, 4)).toEqual({ value: "4", changed: true });
  });

  it("blocks transfer cart quantities above the saved stock limit", () => {
    expect(
      validateTransferCart({
        selectedEstoqueId: "1",
        targetEstoqueId: "2",
        matricula: "0001",
        items: [
          {
            quantity: 5,
            maxQuantity: 4,
            lot: "L1",
            product: { name: "Pipoca", requiresExpiration: true },
          },
        ],
      }),
    ).toBe("Saldo insuficiente neste estoque.");
  });
});
