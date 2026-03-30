// FILE: client/src/components/shared/Skeleton.tsx
// PURPOSE: Shimmer skeleton loading states for left panel, right panel, and KPI cards
// USED BY: LeftPanel (loading), RightPanel (loading), KPISection (loading)
// EXPORTS: Skeleton

/** WHY variant prop: spec Section 8.3 defines distinct skeleton layouts for each
 *  dashboard section with different placeholder shapes and sizes. */

interface SkeletonProps {
  variant: 'left-panel' | 'right-panel' | 'kpi-card';
}

export function Skeleton({ variant }: SkeletonProps) {
  if (variant === 'left-panel') return <LeftPanelSkeleton />;
  if (variant === 'right-panel') return <RightPanelSkeleton />;
  return <KPICardSkeleton />;
}

/** Reusable shimmer block — uses the .skeleton CSS class from index.css */
function ShimmerBlock({ width, height, rounded = 4 }: {
  width: string | number;
  height: number;
  rounded?: number;
}) {
  return (
    <div
      className="skeleton"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height,
        borderRadius: rounded,
      }}
    />
  );
}

/** Left panel: 6 dimension pills + search box + 8 entity rows (spec Section 8.3) */
function LeftPanelSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-base)]">
      {/* Dimension toggles — 2x3 grid of pill placeholders */}
      <div className="rounded-[var(--radius-2xl)] bg-[var(--color-bg-card)] p-[var(--spacing-sm)] shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-3 gap-[5px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBlock key={i} width="100%" height={32} rounded={10} />
          ))}
        </div>
      </div>

      {/* Search box placeholder */}
      <div className="rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-base)] shadow-[var(--shadow-card)]">
        <ShimmerBlock width="100%" height={20} rounded={6} />
      </div>

      {/* Entity list — 8 skeleton rows with name line + meta line */}
      <div className="flex-1 rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
        {/* Sticky header placeholder */}
        <ShimmerBlock width="60%" height={10} rounded={3} />
        <div className="mt-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-xl)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <EntityRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single entity row placeholder — name line (60%) + meta line (40%) */
function EntityRowSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-xs)]">
      <ShimmerBlock width="60%" height={12} />
      <ShimmerBlock width="40%" height={10} />
    </div>
  );
}

/** Right panel: header + KPI grid + chart area + tab area (spec Section 8.3) */
function RightPanelSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-base)]">
      {/* Header — name line (40%) + subtitle line (70%) */}
      <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-xl)] shadow-[var(--shadow-card)]">
        <ShimmerBlock width="40%" height={20} rounded={6} />
        <div className="mt-[var(--spacing-md)]">
          <ShimmerBlock width="70%" height={11} rounded={4} />
        </div>
      </div>

      {/* KPI section — 2 columns: hero card + 2x3 grid */}
      <div className="grid grid-cols-2 gap-[var(--spacing-base)]">
        {/* Hero card placeholder */}
        <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]">
          <ShimmerBlock width="50%" height={10} rounded={3} />
          <div className="mt-[var(--spacing-md)]">
            <ShimmerBlock width="60%" height={28} rounded={6} />
          </div>
          <div className="mt-[var(--spacing-lg)]">
            <ShimmerBlock width="100%" height={100} rounded={4} />
          </div>
        </div>

        {/* KPI grid — 2x3 grid of cards */}
        <div className="grid grid-cols-2 grid-rows-3 gap-[var(--spacing-md)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Charts area placeholder */}
      <div className="grid grid-cols-[3fr_5fr] gap-[var(--spacing-lg)]">
        <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]">
          <ShimmerBlock width="100%" height={160} rounded={80} />
        </div>
        <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]">
          <ShimmerBlock width="40%" height={14} rounded={4} />
          <div className="mt-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-base)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerBlock key={i} width="90%" height={12} />
            ))}
          </div>
        </div>
      </div>

      {/* Tabs area placeholder */}
      <div className="rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]">
        {/* Tab bar */}
        <div className="mb-[var(--spacing-2xl)] flex gap-[var(--spacing-4xl)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerBlock key={i} width={60} height={14} rounded={4} />
          ))}
        </div>
        {/* Table rows */}
        <div className="flex flex-col gap-[var(--spacing-base)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <ShimmerBlock key={i} width="100%" height={14} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Single KPI card skeleton — label placeholder (50%) + value placeholder (30%) */
function KPICardSkeleton() {
  return (
    <div className="flex flex-col justify-center rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] p-[var(--spacing-xl)] shadow-[var(--shadow-card)]">
      <ShimmerBlock width="50%" height={8} rounded={3} />
      <div className="mt-[var(--spacing-md)]">
        <ShimmerBlock width="30%" height={16} rounded={4} />
      </div>
      <div className="mt-[var(--spacing-xs)]">
        <ShimmerBlock width="60%" height={8} rounded={3} />
      </div>
    </div>
  );
}
