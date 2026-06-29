import JsBarcode from "jsbarcode";
import type { Estoque, InventoryCurrentItem, Movement, ProductLot, SystemUser, Waste } from "@/types";
import { escapeHtml, reportBrandHtml, reportBrandStyles } from "@/lib/reportBrand";

export type GlobalSearchPrintResult = "blocked" | "printed";

type ProductPrintData = {
  product: InventoryCurrentItem;
  lots: ProductLot[];
  movements: Movement[];
};

type UserPrintData = {
  user: SystemUser;
  movements: Movement[];
  wastes: Waste[];
  totalWasteValue: number;
};

export type StockPrintProduct = {
  productId: number;
  productName: string;
  barcode: string;
  categoryName: string | null;
  stock: number;
  status: string;
};

type StockPrintData = {
  stock: Estoque;
  products: StockPrintProduct[];
};

function formatDate(value?: string | null) {
  if (!value) return "Sem validade";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function movementLabel(type: Movement["type"]) {
  const labels: Record<Movement["type"], string> = {
    entrada: "Entrada",
    saida: "Retirada",
    desperdicio: "Desperdicio",
    ajuste: "Ajuste",
  };
  return labels[type] ?? type;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function barcodeSvg(code: string, width = 1.4, height = 42) {
  if (typeof document === "undefined") return "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      displayValue: false,
      width,
      height,
      margin: 0,
    });
    svg.setAttribute("class", "barcode-svg");
    svg.setAttribute("aria-label", `Codigo de barras ${code}`);
    return svg.outerHTML;
  } catch {
    return "";
  }
}

function baseStyles() {
  return `
    * { box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    html,
    body {
      height: auto;
      margin: 0;
      overflow: visible;
      color: #0f172a;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
    }
    body { padding: 0; }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    h2 { margin: 0 0 8px; font-size: 14px; }
    ${reportBrandStyles()}
    .muted { color: #64748b; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .box {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 7px 8px;
      min-width: 0;
    }
    .label {
      display: block;
      margin-bottom: 3px;
      color: #64748b;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .value { font-weight: 700; word-break: break-word; }
    section {
      margin-bottom: 12px;
      break-inside: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      page-break-inside: auto;
    }
    th, td {
      border-bottom: 1px solid #e2e8f0;
      padding: 6px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    thead { display: table-header-group; }
    tbody { page-break-inside: auto; }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .number { text-align: right; font-weight: 700; }
    .barcode-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .barcode-svg {
      width: 100%;
      max-width: 360px;
      height: 42px;
    }
    .barcode-number {
      font-family: "Courier New", monospace;
      font-size: 12px;
      letter-spacing: .12em;
    }
    .empty {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      color: #64748b;
    }
    @media print {
      html,
      body {
        height: auto !important;
        overflow: visible !important;
      }
      header, .summary, .barcode-box { break-inside: avoid; }
      section { break-inside: auto; }
    }
  `;
}

function openPrintWindow(title: string, bodyHtml: string): GlobalSearchPrintResult {
  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return "blocked";

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>${baseStyles()}</style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);

  return "printed";
}

function movementsRows(movements: Movement[]) {
  return movements
    .map(
      (movement) => `
        <tr>
          <td>${escapeHtml(formatDate(movement.createdAt))}</td>
          <td>${escapeHtml(movement.productName)}</td>
          <td>${escapeHtml(movementLabel(movement.type))}</td>
          <td class="number">${escapeHtml(movement.quantity)}</td>
          <td>${escapeHtml(movement.estoqueNome ?? "Estoque")}</td>
          <td>${escapeHtml(movement.userName)}</td>
        </tr>
      `,
    )
    .join("");
}

export function printGlobalSearchProduct({
  product,
  lots,
  movements,
}: ProductPrintData): GlobalSearchPrintResult {
  const generatedAt = new Date().toLocaleString("pt-BR");
  const code = product.barcode.trim();
  const renderedCode = barcodeSvg(code);
  const stockLocations = product.estoques.length
    ? product.estoques
    : [
        {
          estoqueId: product.estoqueId ?? 0,
          estoqueNome: product.estoqueNome ?? "Estoque",
          stock: product.stock,
        },
      ];

  const body = `
    <header>
      <div>
        ${reportBrandHtml()}
        <h1>Relatorio de Produto</h1>
        <div class="muted">Gerado em ${escapeHtml(generatedAt)}</div>
      </div>
      <div class="muted">Busca global</div>
    </header>

    <section class="summary">
      <div class="box">
        <span class="label">Produto</span>
        <span class="value">${escapeHtml(product.productName)}</span>
      </div>
      <div class="box">
        <span class="label">Categoria</span>
        <span class="value">${escapeHtml(product.categoryName ?? "Sem categoria")}</span>
      </div>
      <div class="box">
        <span class="label">Status</span>
        <span class="value">${escapeHtml(product.active ? "Ativo" : "Inativo")} / ${escapeHtml(product.status)}</span>
      </div>
      <div class="box">
        <span class="label">Estoque total</span>
        <span class="value">${escapeHtml(product.stock)}</span>
      </div>
      <div class="box">
        <span class="label">Unidade</span>
        <span class="value">${escapeHtml(product.unit)}</span>
      </div>
      <div class="box">
        <span class="label">Preco</span>
        <span class="value">${escapeHtml(money(product.price))}</span>
      </div>
    </section>

    <section class="barcode-box">
      ${renderedCode ? renderedCode : `<strong>Codigo de barras indisponivel</strong>`}
      <div class="barcode-number">${escapeHtml(code)}</div>
    </section>

    <section>
      <h2>Estoque por local</h2>
      <table>
        <thead>
          <tr><th>Estoque</th><th class="number">Quantidade</th></tr>
        </thead>
        <tbody>
          ${stockLocations
            .map(
              (stock) => `
                <tr>
                  <td>${escapeHtml(stock.estoqueNome)}</td>
                  <td class="number">${escapeHtml(stock.stock)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Lotes e validade</h2>
      ${
        lots.length
          ? `<table>
              <thead>
                <tr><th>Lote</th><th>Validade</th><th>Status</th><th class="number">Quantidade</th></tr>
              </thead>
              <tbody>
                ${lots
                  .map(
                    (lot) => `
                      <tr>
                        <td>${escapeHtml(lot.lot)}</td>
                        <td>${escapeHtml(formatDate(lot.expirationDate))}</td>
                        <td>${escapeHtml(lot.status)}</td>
                        <td class="number">${escapeHtml(lot.quantity)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>`
          : `<div class="empty">Nenhum lote encontrado.</div>`
      }
    </section>

    <section>
      <h2>Movimentacoes recentes</h2>
      ${
        movements.length
          ? `<table>
              <thead>
                <tr>
                  <th>Data</th><th>Produto</th><th>Tipo</th><th class="number">Qtd.</th><th>Estoque</th><th>Usuario</th>
                </tr>
              </thead>
              <tbody>${movementsRows(movements)}</tbody>
            </table>`
          : `<div class="empty">Nenhuma movimentacao encontrada.</div>`
      }
    </section>
  `;

  return openPrintWindow(`Produto - ${product.productName}`, body);
}

export function printGlobalSearchUser({
  user,
  movements,
  wastes,
  totalWasteValue,
}: UserPrintData): GlobalSearchPrintResult {
  const generatedAt = new Date().toLocaleString("pt-BR");

  const body = `
    <header>
      <div>
        ${reportBrandHtml()}
        <h1>Relatorio de Usuario</h1>
        <div class="muted">Gerado em ${escapeHtml(generatedAt)}</div>
      </div>
      <div class="muted">Busca global</div>
    </header>

    <section class="summary">
      <div class="box">
        <span class="label">Nome</span>
        <span class="value">${escapeHtml(user.name)}</span>
      </div>
      <div class="box">
        <span class="label">Matricula</span>
        <span class="value">${escapeHtml(user.matricula)}</span>
      </div>
      <div class="box">
        <span class="label">Email</span>
        <span class="value">${escapeHtml(user.email ?? "-")}</span>
      </div>
      <div class="box">
        <span class="label">Tipo</span>
        <span class="value">${escapeHtml(user.role)}</span>
      </div>
      <div class="box">
        <span class="label">Status</span>
        <span class="value">${escapeHtml(user.active ? "Ativo" : "Inativo")}</span>
      </div>
      <div class="box">
        <span class="label">Cadastro</span>
        <span class="value">${escapeHtml(formatDate(user.createdAt))}</span>
      </div>
      <div class="box">
        <span class="label">Movimentacoes</span>
        <span class="value">${escapeHtml(movements.length)}</span>
      </div>
      <div class="box">
        <span class="label">Desperdicios</span>
        <span class="value">${escapeHtml(wastes.length)}</span>
      </div>
      <div class="box">
        <span class="label">Valor perdido</span>
        <span class="value">${escapeHtml(money(totalWasteValue))}</span>
      </div>
    </section>

    <section>
      <h2>Movimentacoes recentes</h2>
      ${
        movements.length
          ? `<table>
              <thead>
                <tr>
                  <th>Data</th><th>Produto</th><th>Tipo</th><th class="number">Qtd.</th><th>Estoque</th><th>Usuario</th>
                </tr>
              </thead>
              <tbody>${movementsRows(movements)}</tbody>
            </table>`
          : `<div class="empty">Nenhuma movimentacao encontrada.</div>`
      }
    </section>

    <section>
      <h2>Desperdicios registrados</h2>
      ${
        wastes.length
          ? `<table>
              <thead>
                <tr>
                  <th>Data</th><th>Produto</th><th>Motivo</th><th class="number">Qtd.</th><th class="number">Valor</th><th>Estoque</th>
                </tr>
              </thead>
              <tbody>
                ${wastes
                  .map(
                    (waste) => `
                      <tr>
                        <td>${escapeHtml(formatDate(waste.createdAt))}</td>
                        <td>${escapeHtml(waste.productName)}</td>
                        <td>${escapeHtml(waste.motivoNome)}</td>
                        <td class="number">${escapeHtml(waste.quantity)}</td>
                        <td class="number">${escapeHtml(money(waste.totalValue))}</td>
                        <td>${escapeHtml(waste.estoqueNome)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>`
          : `<div class="empty">Nenhum desperdicio encontrado.</div>`
      }
    </section>
  `;

  return openPrintWindow(`Usuario - ${user.name}`, body);
}

export function printGlobalSearchStock({
  stock,
  products,
}: StockPrintData): GlobalSearchPrintResult {
  const generatedAt = new Date().toLocaleString("pt-BR");
  const totalQuantity = products.reduce((total, product) => total + product.stock, 0);
  const status = stock.arquivado ? "Arquivado" : stock.ativo ? "Ativo" : "Inativo";

  const body = `
    <header>
      <div>
        ${reportBrandHtml()}
        <h1>Relatorio de Estoque</h1>
        <div class="muted">Gerado em ${escapeHtml(generatedAt)}</div>
      </div>
      <div class="muted">Busca global</div>
    </header>

    <section class="summary">
      <div class="box">
        <span class="label">Estoque</span>
        <span class="value">${escapeHtml(stock.nome)}</span>
      </div>
      <div class="box">
        <span class="label">Tipo</span>
        <span class="value">${escapeHtml(stock.tipo)}</span>
      </div>
      <div class="box">
        <span class="label">Status</span>
        <span class="value">${escapeHtml(status)}</span>
      </div>
      <div class="box">
        <span class="label">Criado em</span>
        <span class="value">${escapeHtml(formatDate(stock.criadoEm))}</span>
      </div>
      <div class="box">
        <span class="label">Produtos com saldo</span>
        <span class="value">${escapeHtml(products.length)}</span>
      </div>
      <div class="box">
        <span class="label">Saldo total</span>
        <span class="value">${escapeHtml(totalQuantity)}</span>
      </div>
    </section>

    <section>
      <h2>Produtos neste estoque</h2>
      ${
        products.length
          ? `<table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Codigo</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th class="number">Saldo</th>
                </tr>
              </thead>
              <tbody>
                ${products
                  .map(
                    (product) => `
                      <tr>
                        <td>${escapeHtml(product.productName)}</td>
                        <td>${escapeHtml(product.barcode)}</td>
                        <td>${escapeHtml(product.categoryName ?? "Sem categoria")}</td>
                        <td>${escapeHtml(product.status)}</td>
                        <td class="number">${escapeHtml(product.stock)}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>`
          : `<div class="empty">Nenhum produto com saldo encontrado neste estoque.</div>`
      }
    </section>
  `;

  return openPrintWindow(`Estoque - ${stock.nome}`, body);
}
