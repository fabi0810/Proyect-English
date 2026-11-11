import type { ErrorType } from '../../types/content';
import catalogJson from '../../data/errors/catalog.json';

export const errorCatalog = catalogJson as Record<string, ErrorType>;

export function catalogText(tag: string): string | undefined {
  const e = errorCatalog[tag];
  return e ? `${e.title}. ${e.explanation}` : undefined;
}
