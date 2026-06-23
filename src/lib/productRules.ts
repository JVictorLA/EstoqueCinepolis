import type { Product, ProductLot } from "@/types";

export type ProductFilters = {
  stockId: string;
  categoryId: string;
  status: string;
  stockStatus: string;
  minPrice: string;
  maxPrice: string;
  minStock: string;
  maxStock: string;
  unit: string;
};

export const emptyProductFilters: ProductFilters = {
  stockId: "all",
  categoryId: "all",
  status: "all",
  stockStatus: "available",
  minPrice: "",
  maxPrice: "",
  minStock: "",
  maxStock: "",
  unit: "",
};

function numberFilter(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function filterProducts(products: Product[], query: string, filters: ProductFilters) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    const matchesQuery =
      !normalizedQuery ||
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.barcode.includes(normalizedQuery);

    const matchesCategory =
      filters.categoryId === "all" || String(product.categoryId) === filters.categoryId;

    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" && product.active) ||
      (filters.status === "inactive" && !product.active);

    const hasLowStock = product.minStock > 0 && product.stock <= product.minStock;
    const matchesStockStatus =
      filters.stockStatus === "all" ||
      (filters.stockStatus === "available" && product.stock > 0) ||
      (filters.stockStatus === "no_stock" && product.stock === 0) ||
      (filters.stockStatus === "low_stock" && hasLowStock);

    const minPrice = numberFilter(filters.minPrice);
    const maxPrice = numberFilter(filters.maxPrice);
    const minStock = numberFilter(filters.minStock);
    const maxStock = numberFilter(filters.maxStock);

    const matchesPrice =
      (minPrice === null || product.price >= minPrice) &&
      (maxPrice === null || product.price <= maxPrice);
    const matchesStock =
      (minStock === null || product.stock >= minStock) &&
      (maxStock === null || product.stock <= maxStock);
    const matchesUnit =
      !filters.unit.trim() ||
      product.unit.toLowerCase().includes(filters.unit.trim().toLowerCase());

    return (
      matchesQuery &&
      matchesCategory &&
      matchesStatus &&
      matchesStockStatus &&
      matchesPrice &&
      matchesStock &&
      matchesUnit
    );
  });
}

export function ean13CheckDigit(base: string) {
  const sum = base
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function generateInternalBarcode() {
  const timestampPart = Date.now().toString().slice(-8);
  const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  const base = `29${timestampPart}${randomPart}`;
  return `${base}${ean13CheckDigit(base)}`;
}

export type AdjustmentStockOption = {
  id: number;
  nome: string;
  stock: number;
  requiresExpiration: boolean;
};

export type AdjustmentProductOption = {
  id: number;
  name: string;
  barcode: string;
  unit: string;
  stocks: AdjustmentStockOption[];
};

export type AdjustmentRow = {
  id: string;
  productId: string;
  productQuery: string;
  stockId: string;
  lotId: string;
  quantityFinal: string;
  reason: string;
};

export function createAdjustmentRow(): AdjustmentRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    productQuery: "",
    stockId: "",
    lotId: "",
    quantityFinal: "",
    reason: "",
  };
}

export function adjustmentProductLabel(product: AdjustmentProductOption) {
  return `${product.name} - ${product.barcode}`;
}

export function isAdjustmentRowTouched(row: AdjustmentRow) {
  return !!(
    row.productQuery.trim() ||
    row.productId ||
    row.stockId ||
    row.lotId ||
    row.quantityFinal.trim() ||
    row.reason
  );
}

export function getAdjustmentProduct(catalog: AdjustmentProductOption[], row: AdjustmentRow) {
  return catalog.find((product) => String(product.id) === row.productId) ?? null;
}

export function getAdjustmentStock(catalog: AdjustmentProductOption[], row: AdjustmentRow) {
  return getAdjustmentProduct(catalog, row)?.stocks.find((stock) => String(stock.id) === row.stockId) ?? null;
}

export function adjustmentRequiresLot(
  row: AdjustmentRow,
  catalog: AdjustmentProductOption[],
  lots: ProductLot[],
) {
  const stock = getAdjustmentStock(catalog, row);
  return !!stock?.requiresExpiration || lots.length > 1;
}

export function validateAdjustmentRow(
  row: AdjustmentRow,
  catalog: AdjustmentProductOption[],
  lots: ProductLot[],
) {
  if (!row.productId) return "Selecione o produto";
  if (!row.stockId) return "Selecione o estoque";
  if (adjustmentRequiresLot(row, catalog, lots) && !row.lotId) return "Selecione o lote";
  if (!row.reason) return "Selecione o motivo do ajuste";
  const quantity = Number(row.quantityFinal);
  if (!Number.isFinite(quantity) || quantity < 0) return "Informe uma quantidade final valida";
  return null;
}

export function isAdjustmentRowComplete(
  row: AdjustmentRow,
  catalog: AdjustmentProductOption[],
  lots: ProductLot[],
) {
  return isAdjustmentRowTouched(row) && !validateAdjustmentRow(row, catalog, lots);
}
