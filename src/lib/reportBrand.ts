import type { jsPDF } from "jspdf";
import reportLogo from "@/icones/android-chrome-512x512.png?inline";

export const REPORT_BRAND_NAME = "Zytrex Inventory";

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function reportBrandStyles() {
  return `
    .report-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #4f7cff;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 6px;
    }
    .report-brand-logo {
      width: 24px;
      height: 24px;
      object-fit: contain;
      flex: 0 0 auto;
    }
  `;
}

export function reportBrandHtml() {
  return `
    <div class="report-brand">
      <img class="report-brand-logo" src="${reportLogo}" alt="" />
      <span>${REPORT_BRAND_NAME}</span>
    </div>
  `;
}

export function addPdfBrand(doc: jsPDF, x = 14, y = 10) {
  const logoSize = 12;

  try {
    doc.addImage(reportLogo, "PNG", x, y, logoSize, logoSize);
  } catch {
    doc.setFillColor(79, 124, 255);
    doc.roundedRect(x, y, logoSize, logoSize, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Z", x + 3.5, y + 8.4);
  }

  doc.setTextColor(79, 124, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(REPORT_BRAND_NAME, x + logoSize + 4, y + 7.8);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "normal");
}
