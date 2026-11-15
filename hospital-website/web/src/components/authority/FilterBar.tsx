import { useMemo, useState } from 'react';
import { fetchIncidents, type AnalyticsFilters } from '../../api-analytics';

const SEVERITY_PRESETS = [
  { label: 'Any', value: undefined },
  { label: '5+', value: '5' },
  { label: '7+', value: '7' },
  { label: '8+', value: '8' },
  { label: '9+', value: '9' },
];

const DATE_PRESETS = [
  { label: 'All time', days: 0 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function split(value: string | undefined) {
  return value ? value.split(',').filter(Boolean) : [];
}

function labelize(value: string) {
  return value.replace(/_/g, ' ');
}

const CSV_COLUMNS: [string, string][] = [
  ['alert_id', 'Alert ID'],
  ['created_at', 'Reported at'],
  ['governorate', 'Governorate'],
  ['severity', 'Severity'],
  ['status', 'Status'],
  ['destination', 'Destination'],
  ['hospital_name', 'Hospital'],
  ['location_label', 'Location'],
  ['lat', 'Latitude'],
  ['lon', 'Longitude'],
  ['full_name', 'Patient'],
  ['age', 'Age'],
  ['gender', 'Sex'],
  ['mechanism', 'Mechanism'],
];

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function downloadCsv(params: Record<string, string>) {
  const rows = await fetchIncidents(params);
  const lines = [
    CSV_COLUMNS.map(([, label]) => csvCell(label)).join(','),
    ...rows.map((row) => CSV_COLUMNS.map(([key]) => csvCell(row?.[key])).join(',')),
  ];
  const blob = new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `road-safety-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return rows.length;
}

export function FilterBar({
  filters,
  params,
  onChange,
}: {
  filters: AnalyticsFilters | null;
  params: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const governorates = filters?.governorates ?? filters?.regions ?? [];
  const selectedGovernorates = useMemo(
    () => split(params.governorate ?? params.region),
    [params.governorate, params.region],
  );
  const selectedHospitals = split(params.hospital);
  const selectedSexes = split(params.sex);
  const selectedAges = split(params.age_group);
  const selectedDestinations = split(params.destination);
  const sevMin = params.severity_min;

  const datePreset = useMemo(() => {
    if (!params.from && !params.to) return 'All time';
    if (!params.from) return 'Custom';
    const match = DATE_PRESETS.find((preset) => preset.days > 0 && isoDaysAgo(preset.days) === params.from);
    return match && !params.to ? match.label : 'Custom';
  }, [params.from, params.to]);

  const set = (patch: Record<string, string | undefined>) => {
    const next = { ...params };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') delete next[key];
      else next[key] = value;
    }
    onChange(next);
  };

  const toggleCsv = (key: string, value: string) => {
    const current = split(params[key]);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    set({ [key]: next.join(',') || undefined });
  };

  const toggleGovernorate = (name: string) => {
    const has = selectedGovernorates.includes(name);
    const next = has
      ? selectedGovernorates.filter((item) => item !== name)
      : [...selectedGovernorates, name];
    set({ governorate: next.join(',') || undefined, region: undefined });
  };

  const setDatePreset = (days: number) => {
    if (days === 0) set({ from: undefined, to: undefined });
    else set({ from: isoDaysAgo(days), to: undefined });
  };

  const activeCount =
    selectedGovernorates.length +
    (sevMin ? 1 : 0) +
    (params.from || params.to ? 1 : 0) +
    selectedHospitals.length +
    selectedSexes.length +
    selectedAges.length +
    selectedDestinations.length;

  const chipClass = (active: boolean) =>
    'press rounded-full px-3 py-1 text-xs font-medium transition-colors';
  const chipStyle = (active: boolean) =>
    active
      ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
      : { background: 'var(--surface-2)', color: 'var(--muted)' };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">Filters</span>
        {activeCount > 0 && (
          <span className="chip rounded-full px-2 py-0.5 text-xs" data-tone="moderate">
            {activeCount} active
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setExporting(true);
              setExportMessage(null);
              downloadCsv(params)
                .then((count) => setExportMessage(`${count.toLocaleString()} cases exported`))
                .catch((error) => setExportMessage(error instanceof Error ? error.message : 'Export failed'))
                .finally(() => setExporting(false));
            }}
            disabled={exporting}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => onChange({})}
            disabled={activeCount === 0}
            className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40 disabled:hover:no-underline"
          >
            Reset
          </button>
        </div>
      </div>

      {exportMessage && <p className="mt-2 text-2xs text-muted" aria-live="polite">{exportMessage}</p>}

      {governorates.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-2xs font-semibold tracking-wide text-muted uppercase">Governorate</span>
            {selectedGovernorates.length > 0 && (
              <span className="text-2xs text-muted">{selectedGovernorates.length} selected</span>
            )}
          </div>
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
            {governorates.map((name) => {
              const active = selectedGovernorates.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleGovernorate(name)}
                  aria-pressed={active}
                  className={chipClass(active)}
                  style={chipStyle(active)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
            Min severity
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_PRESETS.map((preset) => {
              const active = (sevMin ?? undefined) === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => set({ severity_min: preset.value, severity_max: undefined })}
                  aria-pressed={active}
                  className={chipClass(active)}
                  style={chipStyle(active)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
            Period
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => {
              const active = datePreset === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDatePreset(preset.days)}
                  aria-pressed={active}
                  className={chipClass(active)}
                  style={chipStyle(active)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-[var(--surface-2)]"
          >
            {expanded ? 'Hide more filters' : 'More filters'}
            {selectedHospitals.length + selectedSexes.length + selectedAges.length + selectedDestinations.length > 0
              ? ` (${selectedHospitals.length + selectedSexes.length + selectedAges.length + selectedDestinations.length})`
              : ''}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
                Date range
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={params.from ?? ''}
                  onChange={(e) => set({ from: e.target.value, to: undefined })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-[var(--primary)]"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="date"
                  value={params.to ?? ''}
                  onChange={(e) => set({ to: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
                Hospital
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(filters?.hospitals ?? []).map((hospital) => {
                  const value = hospital.code || hospital.name;
                  const active = selectedHospitals.includes(value);
                  return (
                    <button
                      key={`${hospital.code}-${hospital.name}`}
                      type="button"
                      onClick={() => toggleCsv('hospital', value)}
                      aria-pressed={active}
                      className={chipClass(active)}
                      style={chipStyle(active)}
                    >
                      {hospital.name || hospital.code}
                    </button>
                  );
                })}
                {!filters?.hospitals?.length && <span className="text-xs text-muted">None recorded</span>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
                Casualty sex
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(filters?.sexes ?? []).map((sex) => {
                  const active = selectedSexes.includes(sex);
                  return (
                    <button
                      key={sex}
                      type="button"
                      onClick={() => toggleCsv('sex', sex)}
                      aria-pressed={active}
                      className={chipClass(active)}
                      style={chipStyle(active)}
                    >
                      {sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : sex}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
                Age group
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(filters?.age_groups ?? []).map((group) => {
                  const active = selectedAges.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleCsv('age_group', group)}
                      aria-pressed={active}
                      className={chipClass(active)}
                      style={chipStyle(active)}
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-2xs font-semibold tracking-wide text-muted uppercase">
                Destination
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(filters?.destinations ?? []).map((destination) => {
                  const active = selectedDestinations.includes(destination);
                  return (
                    <button
                      key={destination}
                      type="button"
                      onClick={() => toggleCsv('destination', destination)}
                      aria-pressed={active}
                      className={chipClass(active)}
                      style={chipStyle(active)}
                    >
                      {labelize(destination)}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
