/** CSS + shell A4 para impressão Playwright. */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PRINT_CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.35;
  }
  h1, h2, h3 { font-family: Arial, Helvetica, sans-serif; margin: 0 0 6px; }
  h1 { font-size: 12pt; text-align: center; text-transform: uppercase; }
  h2 { font-size: 11pt; text-align: center; margin-bottom: 12px; }
  h3 { font-size: 10pt; margin-top: 14px; border-bottom: 1px solid #000; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9pt; }
  th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  th { background: #f0f0f0; text-align: left; }
  .meta { font-size: 8pt; color: #333; margin-top: 8px; }
  .sign { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; }
  .sign div { flex: 1; text-align: center; font-size: 9pt; }
  .line { border-bottom: 1px solid #000; min-height: 18px; margin: 4px 0 10px; }
  .row { display: flex; gap: 12px; margin-bottom: 6px; }
  .row label { min-width: 140px; font-weight: bold; }
  .check { margin: 4px 0; }
  .attest { margin-top: 16px; text-align: justify; }
`;

export function printDocumentShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Documento</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
