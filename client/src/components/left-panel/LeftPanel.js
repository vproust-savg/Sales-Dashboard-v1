import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// FILE: client/src/components/left-panel/LeftPanel.tsx
// PURPOSE: Left panel container — composes dimension toggles, search, filter/sort, entity list, selection bar
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LeftPanel
import { useState, useCallback, useMemo } from 'react';
import { DimensionToggles } from './DimensionToggles';
import { SearchBox } from './SearchBox';
import { FilterSortToolbar } from './FilterSortToolbar';
import { EntityList } from './EntityList';
import { SelectionBar } from './SelectionBar';
/** WHY: maps Dimension enum values to user-facing plural labels for the list header */
const DIMENSION_LABELS = {
    customer: 'Customers',
    zone: 'Zones',
    vendor: 'Vendors',
    brand: 'Brands',
    product_type: 'Product Types',
    product: 'Products',
};
/** WHY: maps Dimension to search placeholder text that adapts to context */
const SEARCH_PLACEHOLDERS = {
    customer: 'Search customers...',
    zone: 'Search zones...',
    vendor: 'Search vendors...',
    brand: 'Search brands...',
    product_type: 'Search product types...',
    product: 'Search products...',
};
export function LeftPanel({ entities, activeDimension, activeEntityId, selectedEntityIds: initialSelectedIds, }) {
    const [dimension, setDimension] = useState(activeDimension);
    const [searchValue, setSearchValue] = useState('');
    const [filterActive, setFilterActive] = useState(false);
    const [sortActive, setSortActive] = useState(false);
    const [activeId, setActiveId] = useState(activeEntityId);
    const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
    /** WHY: case-insensitive search filters on entity name and meta fields */
    const filteredEntities = useMemo(() => {
        if (!searchValue.trim())
            return entities;
        const query = searchValue.toLowerCase();
        return entities.filter((e) => e.name.toLowerCase().includes(query) ||
            e.meta1.toLowerCase().includes(query));
    }, [entities, searchValue]);
    const handleSelect = useCallback((id) => {
        setActiveId(id);
    }, []);
    const handleCheck = useCallback((id) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]);
    }, []);
    const handleClearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);
    const handleViewConsolidated = useCallback(() => {
        /** WHY: placeholder for Plan C — will trigger consolidated data fetch */
    }, []);
    return (_jsxs(_Fragment, { children: [_jsx(DimensionToggles, { activeDimension: dimension, onDimensionChange: setDimension }), _jsx(SearchBox, { value: searchValue, onChange: setSearchValue, placeholder: SEARCH_PLACEHOLDERS[dimension] }), _jsx(FilterSortToolbar, { filterActive: filterActive, sortActive: sortActive, onFilterToggle: () => setFilterActive((prev) => !prev), onSortToggle: () => setSortActive((prev) => !prev) }), _jsxs("div", { className: "relative flex flex-1 flex-col overflow-hidden", children: [_jsx(EntityList, { entities: filteredEntities, activeId: activeId, selectedIds: selectedIds, onSelect: handleSelect, onCheck: handleCheck, dimensionLabel: DIMENSION_LABELS[dimension], totalCount: entities.length }), _jsx("div", { className: "absolute bottom-0 left-0 right-0", children: _jsx(SelectionBar, { selectedCount: selectedIds.length, onViewConsolidated: handleViewConsolidated, onClear: handleClearSelection }) })] })] }));
}
