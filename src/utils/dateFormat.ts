export function formatDateBR(date?: string) {
  if (!date) {
    return "";
  }

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}/${year}`;
}