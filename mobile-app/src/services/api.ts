import type { CrashDetectedPayload, EmergencyAlert, SensorSample } from '../types';

const BACKEND_URL = 'http://localhost:8000';

export async function submitAlert(samples: SensorSample[], severity: number): Promise<EmergencyAlert> {
  const last = samples[samples.length - 1];
  const payload: CrashDetectedPayload = {
    schema_version: '1.0',
    type: 'crash_detected',
    trip_id: last.trip_id,
    t: last.t,
    location: { lat: last.gps.lat, lon: last.gps.lon },
    severity,
    medical_profile_ref: 'profile-0001',
    detection: { rule: true, ml_confidence: 0.97 },
    factors: {
      peak_g: last.accel.g,
      delta_v_mps: 0,
      speed_at_impact_mps: last.gps.speed_mps,
      impact_type: 'frontal',
      post_crash_inactive: last.gps.speed_mps < 0.5,
      medical_risk: 0,
    },
  };
  const res = await fetch(`${BACKEND_URL}/alerts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Backend error ${res.status}`);
  return res.json() as Promise<EmergencyAlert>;
}