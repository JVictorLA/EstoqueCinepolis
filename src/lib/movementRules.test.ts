import { describe, expect, it } from "vitest";
import { validateMovement } from "./movementRules";

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
});
