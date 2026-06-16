import { describe, expect, it } from "vitest";
import { validateWaste } from "./wasteRules";
import type { Product } from "@/types";

const product = {
  requiresExpiration: false,
  stock: 3,
} as Product;

describe("wasteRules", () => {
  it("returns a numeric quantity when valid", () => {
    expect(
      validateWaste({
        selectedEstoqueId: "1",
        barcode: "789",
        product,
        reasonId: "1",
        quantity: "2",
        lot: "",
      }),
    ).toEqual({ quantity: 2 });
  });

  it("blocks quantities above available stock", () => {
    expect(
      validateWaste({
        selectedEstoqueId: "1",
        barcode: "789",
        product,
        reasonId: "1",
        quantity: "4",
        lot: "",
      }),
    ).toEqual({ error: "Quantidade maior que o estoque atual" });
  });
});
