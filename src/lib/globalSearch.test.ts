import { describe, expect, it } from "vitest";
import { searchProducts, searchStocks, searchUsers } from "./globalSearch";
import type { Estoque, InventoryCurrentItem, SystemUser } from "@/types";

function product(partial: Partial<InventoryCurrentItem>): InventoryCurrentItem {
  return {
    productId: 1,
    barcode: "789",
    productName: "Produto",
    categoryId: null,
    categoryName: null,
    requiresExpiration: false,
    expirationDate: null,
    unit: "un",
    price: 0,
    estoqueId: null,
    estoqueNome: null,
    stock: 0,
    minStock: 0,
    active: true,
    status: "ok",
    estoques: [],
    ...partial,
  };
}

function user(partial: Partial<SystemUser>): SystemUser {
  return {
    id: 1,
    name: "Usuario",
    matricula: "0001",
    email: null,
    role: "operador",
    active: true,
    createdAt: "2026-01-01",
    ...partial,
  };
}

function stock(partial: Partial<Estoque>): Estoque {
  return {
    id: 1,
    nome: "Estoque",
    ativo: true,
    tipo: "permanente",
    arquivado: false,
    arquivadoEm: null,
    criadoEm: "2026-01-01",
    ...partial,
  };
}

describe("globalSearch", () => {
  it("finds products by name", () => {
    const results = searchProducts("pip", [
      product({ productId: 1, productName: "Pipoca Salgada" }),
      product({ productId: 2, productName: "Refrigerante" }),
    ]);

    expect(results.map((item) => item.productName)).toEqual(["Pipoca Salgada"]);
  });

  it("finds products by barcode", () => {
    const results = searchProducts("456", [
      product({ productId: 1, barcode: "123456789", productName: "Agua" }),
      product({ productId: 2, barcode: "999", productName: "Chocolate" }),
    ]);

    expect(results.map((item) => item.barcode)).toEqual(["123456789"]);
  });

  it("finds users by name", () => {
    const results = searchUsers("maria", [
      user({ id: 1, name: "Maria Souza" }),
      user({ id: 2, name: "Joao Lima" }),
    ]);

    expect(results.map((item) => item.name)).toEqual(["Maria Souza"]);
  });

  it("finds users by matricula", () => {
    const results = searchUsers("0042", [
      user({ id: 1, matricula: "0042", name: "Caixa 1" }),
      user({ id: 2, matricula: "0007", name: "Caixa 2" }),
    ]);

    expect(results.map((item) => item.matricula)).toEqual(["0042"]);
  });

  it("sorts exact matches before partial matches", () => {
    const results = searchProducts("coca", [
      product({ productId: 1, productName: "Coca Cola Zero" }),
      product({ productId: 2, productName: "Coca" }),
    ]);

    expect(results.map((item) => item.productName)).toEqual(["Coca", "Coca Cola Zero"]);
  });

  it("finds stocks by name", () => {
    const results = searchStocks("bomboniere", [
      stock({ id: 1, nome: "Bomboniere Principal" }),
      stock({ id: 2, nome: "Almoxarifado" }),
    ]);

    expect(results.map((item) => item.nome)).toEqual(["Bomboniere Principal"]);
  });

  it("sorts exact stock matches before partial matches", () => {
    const results = searchStocks("bar", [
      stock({ id: 1, nome: "Bar Temporario" }),
      stock({ id: 2, nome: "Bar" }),
    ]);

    expect(results.map((item) => item.nome)).toEqual(["Bar", "Bar Temporario"]);
  });

  it("finds stocks ignoring accents and case", () => {
    const results = searchStocks("temporario", [
      stock({ id: 1, nome: "Estoque Temporário" }),
      stock({ id: 2, nome: "Principal" }),
    ]);

    expect(results.map((item) => item.nome)).toEqual(["Estoque Temporário"]);
  });
});
