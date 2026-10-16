import { describe, expect, it } from "vitest";

import { buildFinancialReportPrintDocument } from "./financialReportPrint";

describe("financial report print document", () => {
  it("uses an isolated A4 landscape page with physical margins and repeating table headers", () => {
    const document = buildFinancialReportPrintDocument("<section class=\"financial-report-print\">Relatório</section>", "Pedidos & saldos");

    expect(document).toContain("@page { size: A4 landscape; margin: 12mm; }");
    expect(document).toContain("<title>Relatório financeiro — Pedidos &amp; saldos</title>");
    expect(document).toContain("display: table-header-group");
    expect(document).toContain("<body><section class=\"financial-report-print\">Relatório</section></body>");
    expect(document).not.toContain("80mm");
    expect(document).not.toContain("position: absolute");
  });
});
