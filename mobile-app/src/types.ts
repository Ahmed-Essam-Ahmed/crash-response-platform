export interface SensorSample {
  schema_version: string;
  type: 'sensor_sample';
  t: number;
  trip_id: string;
  seq: number;
  gps: { lat: number; lon: number; speed_mps: number };
  accel: { x: number; y: number; z: number; g: number };
  gyro: { x: number; y: number; z: number };
  context: { hour: number; weather: string; road: string };
}

export interface Trip {
  trip_id: string;
  dt: number;
  label: 'crash' | 'near_miss' | 'normal';
  crash: { time_s: number; severity: number; impact_factors: Record<string, number> } | null;
  samples: SensorSample[];
}

export interface CrashDetectedPayload {
  schema_version: string;
  type: 'crash_detected';
  trip_id: string;
  t: number;
  location: { lat: number; lon: number };
  severity: number;
  medical_profile_ref: string;
  detection: { rule: boolean; ml_confidence: number };
  factors: {
    peak_g: number;
    delta_v_mps: number;
    speed_at_impact_mps: number;
    impact_type: string;
    post_crash_inactive: boolean;
    medical_risk: number;
  };
}

export interface EmergencyAlert {
  alert_id: string;
  status: string;
  severity: number;
  location: { lat: number; lon: number };
  contacts_notified: string[];
  assignment: { hospital_id: string; ambulance_id: string };
  eta_seconds: number;
}