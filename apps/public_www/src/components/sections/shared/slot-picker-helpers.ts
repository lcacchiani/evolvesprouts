export function formatSlotDayAriaLabel(template: string, dayOfMonth: number): string {
  return template.replace('{day}', String(dayOfMonth));
}

export function isMorningWallClockHour(hour: number): boolean {
  return hour < 12;
}
