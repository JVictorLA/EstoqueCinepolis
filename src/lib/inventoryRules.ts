import type { ConferenceItem, InventoryCurrentItem } from "@/types";

export function getConferenceTotals(items: ConferenceItem[]) {
  return {
    items: items.length,
    divergences: items.filter((item) => item.status !== "ok").length,
    shortages: items.filter((item) => item.status === "falta").length,
    surpluses: items.filter((item) => item.status === "sobra").length,
    countedUnits: items.reduce((sum, item) => sum + item.countedQuantity, 0),
  };
}

export function getInventorySummary(items: InventoryCurrentItem[]) {
  return {
    products: items.length,
    units: items.reduce((sum, item) => sum + item.stock, 0),
    low: items.filter((item) => item.status === "estoque_baixo").length,
    critical: items.filter((item) => item.status === "sem_estoque" || item.status === "vencido").length,
  };
}
