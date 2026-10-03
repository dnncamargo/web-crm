function assertPositiveColumns(columns: number) {
  if (!Number.isInteger(columns) || columns <= 0) {
    throw new Error("PrintJob columns must be a positive integer");
  }
}

export function getPrintColumnsForPaperWidth(paperWidthMm: number) {
  if (paperWidthMm === 80) {
    return 48;
  }

  throw new Error("A impressão está disponível apenas para papel de 80 mm.");
}

export function wrapPrintText(text: string, columns: number) {
  assertPositiveColumns(columns);

  return text.split(/\r?\n/).flatMap((sourceLine) => {
    if (sourceLine.length === 0) {
      return [""];
    }

    const lines: string[] = [];
    let remaining = sourceLine.trim();

    while (remaining.length > columns) {
      const candidate = remaining.slice(0, columns + 1);
      const breakAt = candidate.lastIndexOf(" ");
      const splitAt = breakAt > 0 ? breakAt : columns;
      const line = remaining.slice(0, splitAt).trimEnd();

      lines.push(line);
      remaining = remaining.slice(splitAt).trimStart();
    }

    lines.push(remaining);
    return lines;
  });
}

function rightAlign(value: string, columns: number) {
  return value.padStart(columns, " ");
}

export function formatPrintKeyValue(label: string, value: string, columns: number) {
  assertPositiveColumns(columns);

  const labelLines = wrapPrintText(label, columns);
  const valueLines = wrapPrintText(value, columns);

  if (labelLines.length === 1 && valueLines.length === 1 && label.length + value.length + 1 <= columns) {
    return [`${label}${" ".repeat(columns - label.length - value.length)}${value}`];
  }

  return [...labelLines, ...valueLines.map((line) => rightAlign(line, columns))];
}
