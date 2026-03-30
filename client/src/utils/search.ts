// FILE: client/src/utils/search.ts
// PURPOSE: Client-side entity name search (case-insensitive, partial match)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: searchEntities

import type { EntityListItem } from '@shared/types/dashboard';

/** Filter entities by partial name match (case-insensitive) — spec Section 13.2 */
export function searchEntities(
  entities: EntityListItem[],
  term: string,
): EntityListItem[] {
  const lower = term.toLowerCase().trim();
  if (!lower) return entities;
  return entities.filter(e => e.name.toLowerCase().includes(lower));
}
