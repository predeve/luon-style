export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [name: string]: unknown };

export function classText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(classText).filter(Boolean).join(" ");
  }
  if (!value || typeof value !== "object") return "";
  return Object.entries(value)
    .filter(([, active]) => Boolean(active))
    .map(([name]) => name)
    .join(" ");
}
