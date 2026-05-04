export function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekRange(): string[] {
  const today = new Date();
  const range: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    range.push(d.toISOString().slice(0, 10));
  }
  return range;
}

export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}
