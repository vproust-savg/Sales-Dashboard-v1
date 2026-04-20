// FILE: client/src/components/shared/ReportFilterModal.tsx
// PURPOSE: Filter selection modal for Report — dropdowns vary by dimension, item-level fields use text inputs
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ReportFilterModal

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Dimension, EntityListItem, FetchAllFilters } from '@shared/types/dashboard';
import { DIMENSION_PLURAL_LABELS } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';
import { FilterField, TextFilterField } from './ReportFilterPanels';

type FilterKey = 'agentName' | 'zone' | 'customerType' | 'brand' | 'productFamily' | 'countryOfOrigin' | 'foodServiceRetail';

/** WHY: Each dimension exposes a different set of relevant filter controls. Item-level filters
 *  (brand, productFamily, countryOfOrigin, foodServiceRetail) only make sense for dims whose
 *  orders carry those fields. Customer/zone/brand dims operate at entity level only. */
const FILTERS_BY_DIMENSION: Record<Dimension, FilterKey[]> = {
  customer:     ['agentName', 'zone', 'customerType'],
  zone:         ['agentName', 'customerType'],
  vendor:       ['agentName', 'zone', 'customerType', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
  brand:        ['agentName', 'zone', 'customerType'],
  product_type: ['agentName', 'zone', 'customerType', 'brand', 'countryOfOrigin', 'foodServiceRetail'],
  product:      ['agentName', 'zone', 'customerType', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
};

interface ReportFilterModalProps {
  isOpen: boolean;
  entities: EntityListItem[];
  activeDimension: Dimension;
  /** WHY: forceRefresh is passed through so the caller can thread it to useReport.startReport. */
  onConfirm: (filters: FetchAllFilters, forceRefresh: boolean) => void;
  onCancel: () => void;
}

function uniqueValues(entities: EntityListItem[], getter: (e: EntityListItem) => string | null): string[] {
  const set = new Set<string>();
  entities.forEach(e => {
    const v = getter(e);
    if (v) set.add(v);
  });
  return [...set].sort();
}

/** WHY: Parse a comma-separated text input into a trimmed, non-empty string array */
function parseTextInput(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// WHY: Inner component is only mounted while isOpen is true. This forces useState to
// reinitialize on every open, so the previous report's selection cannot leak into the next.
// A useEffect-based reset is unreliable because the modal may be always-mounted and React
// can batch the close+reopen transitions.
export function ReportFilterModal({ isOpen, entities, activeDimension, onConfirm, onCancel }: ReportFilterModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <ReportFilterModalContent
          entities={entities}
          activeDimension={activeDimension}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </AnimatePresence>
  );
}

function ReportFilterModalContent({
  entities,
  activeDimension,
  onConfirm,
  onCancel,
}: Omit<ReportFilterModalProps, 'isOpen'>) {
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  // WHY: Item-level text inputs — comma-separated raw strings parsed on confirm
  const [brandText, setBrandText] = useState('');
  const [productFamilyText, setProductFamilyText] = useState('');
  const [countryText, setCountryText] = useState('');
  const [foodServiceRetailText, setFoodServiceRetailText] = useState('');
  // WHY: Resets to false each time the modal opens. The outer component
  // only mounts ReportFilterModalContent while isOpen, so useState naturally
  // reinitializes on reopen (matches the existing pattern for filter state).
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

  const activeFilters = FILTERS_BY_DIMENSION[activeDimension];

  const reps = useMemo(() => uniqueValues(entities, e => e.rep), [entities]);
  const zones = useMemo(() => uniqueValues(entities, e => e.zone), [entities]);
  const types = useMemo(() => uniqueValues(entities, e => e.customerType), [entities]);

  const estimatedCount = useMemo(() => {
    return entities.filter(e => {
      if (selectedReps.length > 0 && (!e.rep || !selectedReps.includes(e.rep))) return false;
      if (selectedZones.length > 0 && (!e.zone || !selectedZones.includes(e.zone))) return false;
      if (selectedTypes.length > 0 && (!e.customerType || !selectedTypes.includes(e.customerType))) return false;
      return true;
    }).length;
  }, [entities, selectedReps, selectedZones, selectedTypes]);

  const handleConfirm = () => {
    const filters: FetchAllFilters = {};
    if (selectedReps.length > 0) filters.agentName = selectedReps;
    if (selectedZones.length > 0) filters.zone = selectedZones;
    if (selectedTypes.length > 0) filters.customerType = selectedTypes;
    const brands = parseTextInput(brandText);
    if (brands.length > 0) filters.brand = brands;
    const families = parseTextInput(productFamilyText);
    if (families.length > 0) filters.productFamily = families;
    const countries = parseTextInput(countryText);
    if (countries.length > 0) filters.countryOfOrigin = countries;
    const fsValues = parseTextInput(foodServiceRetailText);
    if (fsValues.length > 0) filters.foodServiceRetail = fsValues;
    onConfirm(filters, forceRefresh);
  };

  const pluralLabel = DIMENSION_PLURAL_LABELS[activeDimension].toLowerCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[420px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
        role="dialog"
        aria-label="Report filters"
      >
        <div className="flex flex-col items-center gap-[var(--spacing-md)]">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Please select</h2>
        </div>

        {activeFilters.includes('agentName') && (
          <FilterField label="Sales Rep" options={reps} selected={selectedReps} onChange={setSelectedReps} />
        )}
        {activeFilters.includes('zone') && (
          <FilterField label="Zone" options={zones} selected={selectedZones} onChange={setSelectedZones} />
        )}
        {activeFilters.includes('customerType') && (
          <FilterField label="Customer Type" options={types} selected={selectedTypes} onChange={setSelectedTypes} />
        )}
        {activeFilters.includes('brand') && (
          <TextFilterField label="Brand" value={brandText} onChange={setBrandText} placeholder="Brand A, Brand B" />
        )}
        {activeFilters.includes('productFamily') && (
          <TextFilterField label="Product Family" value={productFamilyText} onChange={setProductFamilyText} placeholder="Family X, Family Y" />
        )}
        {activeFilters.includes('countryOfOrigin') && (
          <TextFilterField label="Country" value={countryText} onChange={setCountryText} placeholder="Italy, France" />
        )}
        {activeFilters.includes('foodServiceRetail') && (
          <TextFilterField label="FS vs Retail" value={foodServiceRetailText} onChange={setFoodServiceRetailText} placeholder="Y for Retail, N for Food Service" />
        )}

        <label className="flex cursor-pointer items-start gap-[var(--spacing-sm)]">
          <input
            type="checkbox"
            checked={forceRefresh}
            onChange={(e) => setForceRefresh(e.target.checked)}
            className="mt-[2px] h-[14px] w-[14px] accent-[var(--color-gold-primary)]"
          />
          <span className="text-[12px] leading-snug text-[var(--color-text-secondary)]">
            <span className="font-medium">Full refresh</span>
            <span className="text-[var(--color-text-muted)]"> (slower)</span>
            <br />
            <span className="text-[var(--color-text-muted)]">
              Re-fetches all orders including any retroactive edits. Use when YoY numbers look off.
            </span>
          </span>
        </label>

        <p className="text-center text-[12px] text-[var(--color-text-muted)]">
          Fetching data for {formatInteger(estimatedCount)} {pluralLabel}. Estimated 10&ndash;15 minutes.
        </p>

        <div className="flex gap-[var(--spacing-md)]">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-gold-muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-dark-hover)]"
          >
            Start
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


