function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getToday(): string {
  return formatLocalDate(new Date());
}

export function getWeekRange(): string[] {
  const today = new Date();
  const range: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    range.push(formatLocalDate(d));
  }
  return range;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
