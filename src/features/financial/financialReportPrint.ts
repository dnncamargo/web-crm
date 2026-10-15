const financialReportPrintStyles = `
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { width: 100%; min-width: 0; margin: 0; padding: 0; background: #fff; color: #111; }
  body { font: 8pt/1.35 Arial, sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .financial-report-print { display: block; width: 100%; max-width: 100%; color: #111; background: #fff; }
  .financial-report-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: 1px solid #777; margin-bottom: 6mm; padding-bottom: 3mm; }
  .financial-report-header h1, .financial-report-header h2, .financial-report-header p { margin: 0 0 1mm; }
  .financial-report-title { text-align: right; }
  .financial-report-title h2 { font-size: 14pt; }
  .financial-report-print > p { margin: 2mm 0; }
  .financial-report-table { width: 100%; max-width: 100%; margin-top: 4mm; border-collapse: collapse; table-layout: fixed; text-align: left; font-size: 6.5pt; }
  .financial-report-table thead { display: table-header-group; }
  .financial-report-table th, .financial-report-table td { overflow-wrap: anywhere; border: 1px solid #999; padding: 1.2mm 1.4mm; vertical-align: top; }
  .financial-report-table th { background: #eee; }
  .financial-report-table tr { break-inside: avoid; page-break-inside: avoid; }
  .financial-report-total { margin-top: 4mm !important; font-weight: 700; break-inside: avoid; page-break-inside: avoid; }
  .financial-report-footer { margin-top: 6mm; border-top: 1px solid #aaa; padding-top: 2mm; color: #555; font-size: 7pt; }
  @media screen { body { padding: 12mm; } }
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function buildFinancialReportPrintDocument(reportMarkup: string, title: string): string {
  return `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Relatório financeiro — ${escapeHtml(title)}</title>
        <style>${financialReportPrintStyles}</style>
      </head>
      <body>${reportMarkup}</body>
    </html>`;
}

export function openFinancialReportPrintWindow(reportMarkup: string, title: string): boolean {
  const printWindow = window.open("", "_blank", "popup,width=1200,height=800");
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(buildFinancialReportPrintDocument(reportMarkup, title));
  printWindow.document.close();
  printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
  void printWindow.document.fonts.ready.then(() => printWindow.print());
  return true;
}
