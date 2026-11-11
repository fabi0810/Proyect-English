/** Une clases condicionales: cn('a', cond && 'b'). */
export function cn(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ');
}
