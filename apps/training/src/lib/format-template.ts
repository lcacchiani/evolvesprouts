export function formatProgressLabel(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total));
}

export function formatTemplateValue(template: string, key: string, value: number): string {
  return template.replace(`{${key}}`, String(value));
}
