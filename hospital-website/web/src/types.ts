export type IncidentStatus =
  | 'detected'
  | 'contacts_notified'
  | 'ambulance_assigned'
  | 'en_route_to_scene'
  | 'on_scene'
  | 'en_route_to_hospital'
  | 'at_hospital'
  | 'closed'
  | 'cancelled';

export interface IncidentEvent {
  status: IncidentStatus;
  note: string | null;
  at_scene: boolean;
  created_at: string | null;
}

export interface Incident {
  alert_id: string;
  trip_id: string;
  severity: number;
  lat: number;
  lon: number;
  status: IncidentStatus;
  destination: string;
  medical_profile_ref: string | null;
  assignment: { hospital_id: string | null; ambulance_ids: string[] };
  eta_scene_seconds: number | null;
  eta_hospital_seconds: number | null;
  detection: Record<string, unknown> | null;
  impact_factors: Record<string, number> | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  events?: IncidentEvent[];
}

export interface Hospital {
  hospital_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  trauma_level: number;
  current_load: number;
  free_beds: number;
}

export interface Ambulance {
  ambulance_id: string;
  lat: number;
  lon: number;
  status: string;
  hospital_id: string | null;
  incident_id: number | null;
}

export type StreamEvent =
  | { type: 'incident_detected'; incident: Incident; required_resources: Record<string, unknown> }
  | { type: 'incident_status'; alert_id: string; status: IncidentStatus; note: string | null; at_scene: boolean; at: string }
  | { type: 'fleet_update'; alert_id: string; status: IncidentStatus; ambulances: Ambulance[] }
  | { type: 'hospitals_update'; hospitals: Hospital[] };
