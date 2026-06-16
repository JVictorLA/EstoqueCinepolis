import { describe, expect, it } from "vitest";
import { getConferenceTotals, getInventorySummary } from "./inventoryRules";
import type { ConferenceItem, InventoryCurrentItem } from "@/types";

describe("inventoryRules", () => {
  it("calculates conference totals", () => {
    const items = [
      { status: "ok", countedQuantity: 2 },
      { status: "falta", countedQuantity: 1 },
      { status: "sobra", countedQuantity: 4 },
    ] as ConferenceItem[];

    expect(getConferenceTotals(items)).toMatchObject({
      items: 3,
      divergences: 2,
      shortages: 1,
      surpluses: 1,
      countedUnits: 7,
    });
  });

  it("calculates inventory summary", () => {
    const items = [
      { stock: 2, status: "ok" },
      { stock: 0, status: "sem_estoque" },
      { stock: 1, status: "estoque_baixo" },
    ] as InventoryCurrentItem[];

    expect(getInventorySummary(items)).toEqual({
      products: 3,
      units: 3,
      low: 1,
      critical: 1,
    });
  });
});
