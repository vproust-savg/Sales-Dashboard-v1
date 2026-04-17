// FILE: client/src/utils/search.ts
// PURPOSE: Client-side entity name search (case-insensitive, partial match)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: searchEntities

import type { EntityListItem } from '@shared/types/dashboard';

/** Filter entities by partial name or ID match (case-insensitive) — spec Section 13.2 */
export function searchEntities(
  entities: EntityListItem[],
  term: string,
): EntityListItem[] {
  const lower = term.toLowerCase().trim();
  if (!lower) return entities;
  // WHY match on id too: IDs are meaningful to users (customer IDs like C7826,
  // vendor codes, SKUs). Matching both fields is always safe — IDs rarely collide
  // with name substrings, and if they do, the user sees both matches.
  return entities.filter(
    (e) => e.name.toLowerCase().includes(lower) || e.id.toLowerCase().includes(lower),
  );
}
