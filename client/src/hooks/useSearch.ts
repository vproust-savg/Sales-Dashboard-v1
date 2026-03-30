// FILE: client/src/hooks/useSearch.ts
// PURPOSE: Search term state — debounce is handled in the SearchBox component (spec 13.2)
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: useSearch

import { useState, useCallback } from 'react';

export function useSearch() {
  const [searchTerm, setSearchTerm] = useState('');

  // WHY: Debounce lives in the SearchBox component (controlled input with setTimeout),
  // not here. This hook stores the committed (debounced) search term that drives filtering.

  const resetSearch = useCallback(() => setSearchTerm(''), []);

  return { searchTerm, setSearchTerm, resetSearch };
}
