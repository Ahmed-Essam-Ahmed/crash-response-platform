export type Tone = 'critical' | 'serious' | 'moderate' | 'mild';

export const TONES: Tone[] = ['critical', 'serious', 'moderate', 'mild'];

const WORDS: Record<Tone, string> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  mild: 'Mild',
};

const HUES: Record<Tone, number> = {
  critical: 0,
  serious: 38,
  moderate: 95,
  mild: 160,
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
  contacts_notified: { headline: 'Family has been contacted', action: 'Send an ambulance' },
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

export function severityWord(severity: number) {
  return WORDS[toneForSeverity(severity)];
}

/** Token-driven index used to stagger list entry without hardcoded per-item delays. */
export function toneStagger(tone: Tone, index: number) {
  return HUES[tone] * 0.02 + index * 0.03;
}
