export function formatCurrencyBR(value?: number | null) {
  if (value === undefined || value === null) {
    return "Não definido";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseCurrencyInput(value: string) {
  const normalizedValue = value
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsedValue = Number(normalizedValue);

  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return parsedValue;
}   