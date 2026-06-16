import { describe, expect, it, vi } from "vitest";
import {
  createAdjustmentRow,
  emptyProductFilters,
  filterProducts,
  generateInternalBarcode,
  validateAdjustmentRow,
} from "./productRules";
import type { Product } from "@/types";

function product(patch: Partial<Product>): Product {
  return {
    id: 1,
    barcode: "789",
    name: "Chocolate",
    categoryId: 10,
    categoryName: "Bomboniere",
    requiresExpiration: false,
    expirationDate: null,
    unit: "un",
    price: 10,
    stock: 5,
    minStock: 2,
    active: true,
    favorite: false,
    createdAt: "2026-01-01",
    ...patch,
  };
}

describe("productRules", () => {
  it("filters products by query, category, status, stock and price", () => {
    const items = [
      product({ id: 1, name: "Chocolate", categoryId: 10, price: 10, stock: 5 }),
      product({ id: 2, name: "Refrigerante", categoryId: 11, price: 20, stock: 0 }),
    ];

    expect(
      filterProducts(items, "choc", {
        ...emptyProductFilters,
        categoryId: "10",
        status: "active",
        stockStatus: "available",
        minPrice: "5",
        maxPrice: "15",
      }),
    ).toHaveLength(1);
  });

  it("generates an EAN-13 internal barcode", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234567890123);
    vi.spyOn(Math, "random").mockReturnValue(0.42);

    expect(generateInternalBarcode()).toMatch(/^29\d{11}$/);

    vi.restoreAllMocks();
  });

  it("validates adjustment rows", () => {
    const row = createAdjustmentRow();
    expect(validateAdjustmentRow(row, [], [])).toBe("Selecione o produto");
  });
});
