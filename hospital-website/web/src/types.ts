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

export type Role = 'admin' | 'dispatcher' | 'viewer';

export interface IncidentEvent {
  status: IncidentStatus;
  note: string | null;
  at_scene: boolean;
  created_at: string | null;
}

export interface Patient {
  name: string | null;
  age: number | null;
  blood_type: string | null;
  gender: string | null;
  conditions: string[];
  medications: string[];
  allergies: string[];
  notes: string | null;
}

export interface CaseLocation {
  lat: number;
  lon: number;
  label: string | null;
  maps_url: string;
  directions_url: string;
}

export interface Assignment {
  accepted: boolean;
  accepted_at: string | null;
  accepted_by: string | null;
  ambulance_ids: string[];
}

export interface Incident {
  alert_id: string;
  trip_id: string;
  severity: number;
  severity_source: string;
  severity_confidence: number | null;
  severity_summary: string | null;
  status: IncidentStatus;
  status_step: number;
  destination: string;
  patient: Patient | null;
  location: CaseLocation;
  occurred_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  eta_scene_seconds: number | null;
  eta_hospital_seconds: number | null;
  distance_m: number | null;
  assignment: Assignment;
  share_text: string;
  events?: IncidentEvent[];
}

export interface Offer {
  offer_id: number;
  alert_id: string;
  stage: number;
  broadcast: boolean;
  status: string;
  offered_at: string;
  expires_at: string;
  distance_m: number | null;
  eta_seconds: number | null;
  incident: Incident;
}

export interface Hospital {
  hospital_id: string;
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  location_label: string | null;
  phone: string | null;
  emergency_phone: string | null;
  trauma_level: number;
  ambulances_total: number;
  ambulances_available: number;
  beds_total: number;
  beds_occupied: number;
  free_beds: number;
  maps_url: string;
}

export interface Ambulance {
  ambulance_id: string;
  label: string | null;
  lat: number;
  lon: number;
  status: string;
  hospital_id: number | null;
  incident_id: number | null;
}

export interface User {
  user_id: number;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

export interface CasesResponse {
  assigned: Incident[];
  recent: Incident[];
  offers: Offer[];
}

export interface Session {
  token: string;
  expires_at: string;
  user: User;
  hospital: Hospital;
}

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
  type: string;
}

export type StreamEvent =
  | { type: 'case_opened'; alert_id: string; required_resources: Record<string, unknown>; at: string }
  | { type: 'case_offered'; alert_id: string; incident: Incident; at: string }
  | { type: 'case_updated'; alert_id: string; incident: Incident; at: string }
  | { type: 'case_status'; alert_id: string; status: IncidentStatus; note: string | null; at_scene: boolean; incident: Incident; at: string }
  | { type: 'case_closed'; alert_id: string; incident: Incident; at: string }
  | { type: 'case_escalated'; alert_id: string; stage: number | string; at?: string }
  | { type: 'case_unclaimed'; alert_id: string }
  | { type: 'fleet_update'; alert_id: string; status: IncidentStatus; ambulances: Ambulance[] }
  | { type: 'capacity_changed'; kind: 'fleet' | 'beds'; hospital: Hospital; at: string };
