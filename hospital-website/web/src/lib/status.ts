export type Tone = 'critical' | 'serious' | 'moderate' | 'mild' | 'neutral';

export const TONES: Record<Tone, { chip: string; dot: string; text: string }> = {
  critical: {
    chip: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  serious: {
    chip: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/25',
    dot: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
  },
  moderate: {
    chip: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  mild: {
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  neutral: {
    chip: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/25',
    dot: 'bg-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
  },
};

export const STEPS = [
  { key: 'detected', label: 'Reported' },
  { key: 'contacts_notified', label: 'Family told' },
  { key: 'ambulance_assigned', label: 'Team sent' },
  { key: 'en_route_to_scene', label: 'On the way' },
  { key: 'on_scene', label: 'At the crash' },
  { key: 'en_route_to_hospital', label: 'Bringing patient' },
  { key: 'at_hospital', label: 'Arrived' },
  { key: 'closed', label: 'Finished' },
] as const;

const PLAIN: Record<string, { headline: string; action: string | null }> = {
  detected: { headline: 'Crash reported — we are reviewing it', action: 'Start response' },
  contacts_notified: { headline: "Family has been contacted", action: 'Send an ambulance' },
  ambulance_assigned: { headline: 'Ambulance crew assigned', action: 'Dispatch to the scene' },
  en_route_to_scene: { headline: 'Ambulance is driving to the crash', action: 'Mark crew on scene' },
  on_scene: { headline: 'Crew is treating the patient', action: 'Load patient and travel' },
  en_route_to_hospital: { headline: 'Patient is on the way here', action: 'Confirm arrival' },
  at_hospital: { headline: 'Patient arrived at the hospital', action: 'Close this case' },
  closed: { headline: 'Case finished', action: null },
  cancelled: { headline: 'This call was cancelled', action: null },
};

export function plainFor(status: string) {
  return PLAIN[status] ?? { headline: status, action: null };
}

export function stepIndex(status: string) {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

export function toneForSeverity(severity: number): Tone {
  if (severity >= 8) return 'critical';
  if (severity >= 5.5) return 'serious';
  if (severity >= 3) return 'moderate';
  return 'mild';
}

const WORDS: Record<Tone, string> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  mild: 'Mild',
  neutral: 'Mild',
};

export function severityWord(severity: number) {
  return WORDS[toneForSeverity(severity)];
}

export function isCritical(severity: number) {
  return severity >= 8;
}
