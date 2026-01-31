/**
 * Exports the statement dialog content to a printable PDF via the browser.
 * This opens a new window with the report HTML and triggers print.
 * Returns false if the popup was blocked.
 */
export const exportStatementPdf = (
  element: HTMLElement,
  title: string,
): boolean => {
  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          ${styles}
          body { margin: 16px; font-family: system-ui, sans-serif; }
          [data-statement-export] { max-width: 100%; }
          @media print {
            body { margin: 16px; }
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return false;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    document.body.removeChild(iframe);
  }, 300);

  return true;
};
