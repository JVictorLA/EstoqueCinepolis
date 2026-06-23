import JsBarcode from "jsbarcode";
import type { Product } from "@/types";
import { escapeHtml, reportBrandHtml, reportBrandStyles } from "@/lib/reportBrand";

type ProductPrintResult = "empty" | "blocked" | "printed";

type ProductPrintOptions = {
  stockName: string;
};

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function productStatus(product: Product) {
  return product.active ? "Ativo" : "Inativo";
}

function barcodeSvg(code: string) {
  if (typeof document === "undefined") return "";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  try {
    JsBarcode(svg, code, {
      format: "CODE128",
      displayValue: false,
      width: 1.3,
      height: 28,
      margin: 0,
    });
    svg.setAttribute("class", "barcode-svg");
    svg.setAttribute("aria-label", `Codigo de barras ${code}`);
    return svg.outerHTML;
  } catch {
    return "";
  }
}

export function printProductsTable(
  products: Product[],
  options: ProductPrintOptions,
): ProductPrintResult {
  if (products.length === 0) return "empty";

  const generatedAt = new Date().toLocaleString("pt-BR");
  const rows = products
    .map((product) => {
      const code = product.barcode.trim();
      const renderedCode = barcodeSvg(code);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(product.unit)}</span>
          </td>
          <td>${escapeHtml(product.categoryName ?? "Sem categoria")}</td>
          <td>${escapeHtml(product.estoqueNome ?? "Todos os estoques")}</td>
          <td class="number">${escapeHtml(product.stock)}</td>
          <td class="number">${escapeHtml(money(product.price))}</td>
          <td>${escapeHtml(productStatus(product))}</td>
          <td class="barcode-cell">
            ${
              renderedCode
                ? `<div class="barcode">${renderedCode}</div>`
                : `<div class="barcode-fallback">Codigo indisponivel</div>`
            }
            <div class="barcode-number">${escapeHtml(code)}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return "blocked";

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatorio de produtos</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4 landscape; margin: 12mm; }
          html,
          body {
            height: auto;
            margin: 0;
            overflow: visible;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
          }
          body { padding: 0; }
          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          h1 { margin: 0 0 4px; font-size: 18px; }
          ${reportBrandStyles()}
          .muted { color: #64748b; }
          .summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 10px;
          }
          .box {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 8px;
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
          .value { font-weight: 700; }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            page-break-inside: auto;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 5px 6px;
            text-align: left;
            vertical-align: middle;
          }
          thead { display: table-header-group; }
          tbody { display: table-row-group; }
          th {
            background: #f8fafc;
            color: #475569;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: .04em;
          }
          th:nth-child(1) { width: 22%; }
          th:nth-child(2) { width: 13%; }
          th:nth-child(3) { width: 13%; }
          th:nth-child(4) { width: 7%; }
          th:nth-child(5) { width: 9%; }
          th:nth-child(6) { width: 8%; }
          th:nth-child(7) { width: 28%; }
          td strong {
            display: block;
            margin-bottom: 2px;
            font-size: 10.5px;
            line-height: 1.2;
          }
          td span {
            display: block;
            color: #64748b;
            font-size: 9px;
          }
          .number {
            text-align: right;
            font-weight: 700;
          }
          .barcode-cell {
            text-align: center;
          }
          .barcode {
            display: flex;
            justify-content: center;
            overflow: hidden;
          }
          .barcode-svg {
            width: 100%;
            max-width: 220px;
            height: 28px;
          }
          .barcode-number {
            margin-top: 2px;
            color: #0f172a;
            font-family: "Courier New", monospace;
            font-size: 9px;
            letter-spacing: .08em;
          }
          .barcode-fallback {
            color: #dc2626;
            font-size: 10px;
            font-weight: 700;
          }
          tr {
            break-inside: auto;
            page-break-inside: auto;
          }
          @media print {
            html,
            body {
              height: auto !important;
              overflow: visible !important;
            }
            table { page-break-after: auto; }
            header, .summary { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            ${reportBrandHtml()}
            <h1>Relatorio de Produtos</h1>
            <div class="muted">Gerado em ${escapeHtml(generatedAt)}</div>
          </div>
          <div class="muted">Total de produtos: ${escapeHtml(products.length)}</div>
        </header>

        <section class="summary">
          <div class="box">
            <span class="label">Estoque</span>
            <span class="value">${escapeHtml(options.stockName)}</span>
          </div>
          <div class="box">
            <span class="label">Produtos impressos</span>
            <span class="value">${escapeHtml(products.length)}</span>
          </div>
          <div class="box">
            <span class="label">Formato</span>
            <span class="value">Tabela A4 com codigo de barras</span>
          </div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Estoque</th>
              <th>Qtd.</th>
              <th>Preco</th>
              <th>Catalogo</th>
              <th>Codigo de barras</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);

  return "printed";
}
