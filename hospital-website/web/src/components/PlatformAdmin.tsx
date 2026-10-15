import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  fetchPlatformIncident,
  fetchPlatformOverview,
  getPlatformKey,
  interveneOnIncident,
  reviewHospitalClaim,
  setPlatformKey,
  updatePlatformCapacity,
  type PlatformOverview,
} from '../api';
import './platform-admin.css';
import { LiveMap } from './LiveMap';
import { DetailSheet } from './DetailSheet';
import type { Incident } from '../types';

type Panel = 'incidents' | 'network' | 'claims';
type Layer = 'hospitals' | 'incidents' | 'ambulances';

const EMPTY: PlatformOverview = { generated_at: '', hospitals: [], ambulances: [], incidents: [], pending_claims: [] };

function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    radar: <><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4-6.4M5.6 18.4A9 9 0 0 0 21 12"/><circle cx="12" cy="12" r="1"/></>,
    pulse: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    hospital: <><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M12 7v6m-3-3h6M8 21v-4h8v4"/></>,
    ambulance: <><path d="M3 7h11v11H3zM14 11h4l3 3v4h-7z"/><circle cx="7.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><path d="M8 11v4m-2-2h4"/></>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] ?? paths.radar}</svg>;
}

function ageLabel(iso: string | null) {
  if (!iso) return 'JUST NOW';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return minutes < 1 ? 'JUST NOW' : `${minutes}M AGO`;
}

function AccessGate({ onAccess }: { onAccess: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await fetchPlatformOverview(key); onAccess(key); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not open the operations network'); }
    finally { setBusy(false); }
  };
  return <main className="adm-gate"><div className="adm-gate-orbit"/><form className="adm-gate-card" onSubmit={submit}>
    <div className="adm-brand-mark"><Glyph name="radar" size={24}/></div>
    <p className="adm-eyebrow">CRASH RESPONSE PLATFORM <span> / ROOT ACCESS</span></p>
    <h1>National operations<br/><em>command</em></h1>
    <p className="adm-muted">Authenticate to access the nationwide hospital, incident, and fleet picture.</p>
    <label className="adm-field-label" htmlFor="platform-key">PLATFORM ADMIN KEY</label>
    <input id="platform-key" className="adm-key-input" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter secure access key" required />
    {error && <p className="adm-error" role="alert">{error}</p>}
    <button className="adm-primary-button" disabled={busy}>{busy ? 'VERIFYING ACCESS…' : 'ENTER CONTROL ROOM'} <Glyph name="arrow" size={17}/></button>
    <div className="adm-gate-foot"><span className="adm-live-dot"/> ENCRYPTED OPERATIONS CHANNEL <span>BUILD 03.09</span></div>
  </form></main>;
}

export function PlatformAdmin({ initialKey = '', onExit }: { initialKey?: string; onExit?: () => void }) {
  const [key, setKey] = useState(initialKey || getPlatformKey());
  const [data, setData] = useState<PlatformOverview>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<Panel>('incidents');
  const [layers, setLayers] = useState<Set<Layer>>(new Set(['hospitals', 'incidents', 'ambulances']));
  const [working, setWorking] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [caseDetails, setCaseDetails] = useState<Incident | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const refresh = useCallback(async (showLoading = false) => {
    if (!key) return;
    if (showLoading) setLoading(true);
    try { setData(await fetchPlatformOverview(key)); setConnected(true); setError(''); }
    catch (err) {
      setConnected(false);
      if (err instanceof ApiError && err.status === 401) { setPlatformKey(''); setKey(''); }
      setError(err instanceof Error ? err.message : 'Operations feed unavailable');
    } finally { setLoading(false); }
  }, [key]);
  useEffect(() => { if (key) { setPlatformKey(key); void refresh(true); const timer = window.setInterval(() => void refresh(), 5000); return () => window.clearInterval(timer); } }, [key, refresh]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) { setQuery(''); searchRef.current?.blur(); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const stats = useMemo(() => ({
    activeIncidents: data.incidents.length,
    critical: data.incidents.filter((item) => item.severity >= 8).length,
    movingUnits: data.ambulances.filter((item) => ['en_route', 'en_route_to_scene', 'en_route_to_hospital', 'transporting', 'on_scene'].includes(item.status)).length,
    totalUnits: data.ambulances.filter((item) => item.status !== 'out_of_service').length,
    readyUnits: data.ambulances.filter((item) => item.status === 'available').length,
    hospitals: data.hospitals.length,
    freeBeds: data.hospitals.reduce((sum, hospital) => sum + hospital.free_beds, 0),
    beds: data.hospitals.reduce((sum, hospital) => sum + hospital.beds_total, 0),
  }), [data]);

  const filteredIncidents = data.incidents.filter((item) => `${item.alert_id} ${item.location_label ?? ''} ${item.hospital_name ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const selected = data.incidents.find((item) => item.alert_id === selectedIncident);
  const selectedFacility = data.hospitals.find((item) => item.id === selectedHospital);
  const toggleLayer = (layer: Layer) => setLayers((current) => { const next = new Set(current); if (next.has(layer)) next.delete(layer); else next.add(layer); return next; });

  const decideClaim = async (id: number, decision: 'approve' | 'reject') => {
    setWorking(id);
    try { await reviewHospitalClaim(key, id, decision); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not review claim'); }
    finally { setWorking(null); }
  };

  const openIncident = useCallback(async (alertId: string) => {
    setSelectedIncident(alertId);
    try { setCaseDetails(await fetchPlatformIncident(key, alertId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load case details'); }
  }, [key]);

  const saveHospitalCapacity = async (body: { beds_total?: number; ambulances_total?: number; ambulances_available?: number }) => {
    if (!selectedFacility) return;
    setActionBusy(true);
    try { await updatePlatformCapacity(key, selectedFacility.id, body); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update hospital capacity'); }
    finally { setActionBusy(false); }
  };

  const incidentAction = async (action: 'advance' | 'cancel') => {
    if (!selected) return;
    setActionBusy(true);
    try { await interveneOnIncident(key, selected.alert_id, action); setSelectedIncident(null); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update incident'); }
    finally { setActionBusy(false); }
  };

  if (!key) return <AccessGate onAccess={(value) => { setPlatformKey(value); setKey(value); }} />;
  const shown = panel === 'incidents' ? filteredIncidents.length : panel === 'network' ? data.hospitals.length : data.pending_claims.length;
  const updatedTime = data.generated_at ? new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  return <main className="platform-admin">
    <aside className="adm-rail">
      <div className="adm-rail-logo">R+</div>
      <span className="adm-rail-divider"/>
      <button className="adm-rail-button selected" title="National command"><Glyph name="pulse"/></button>
      <button className="adm-rail-button" title="Hospitals" onClick={() => setPanel('network')}><Glyph name="hospital"/></button>
      <button className="adm-rail-button" title="Incidents" onClick={() => setPanel('incidents')}><Glyph name="alert"/></button>
      <button className="adm-rail-button" title="Review claims" onClick={() => setPanel('claims')}><Glyph name="check"/></button>
      <div className="adm-rail-bottom"><span className="adm-rail-divider"/><button className="adm-rail-button" title="Lock admin session" onClick={() => { setPlatformKey(''); setKey(''); onExit?.(); }}><Glyph name="logout"/></button></div>
    </aside>

    <section className="adm-workspace">
      <header className="adm-topbar">
        <div className="adm-brandline"><div className="adm-brand-small">R+</div><span>RESPONSE HUB <i>/</i> NATIONAL OPERATIONS</span><span className="adm-env-tag">PLATFORM ADMIN</span></div>
        <div className="adm-top-actions"><label className="adm-search"><Glyph name="search" size={16}/><input ref={searchRef} aria-label="Search hospitals, incidents, or ambulances" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search network…"/><kbd>⌘ K</kbd></label><span className={`adm-connection ${connected ? 'online' : ''}`}><i/>{connected ? 'NETWORK LIVE' : 'CONNECTING'}</span><button className="adm-icon-button" title="Refresh now" onClick={() => void refresh(true)}><span className={loading ? 'adm-spin' : ''}>↻</span></button></div>
      </header>

      <div className="adm-content">
        <div className="adm-page-heading"><div><p className="adm-eyebrow">NATIONAL GRID <span>• EGYPT / CAIRO OPERATIONS</span></p><h1>Command <em>overview</em></h1><p className="adm-subtitle">Nationwide emergency response network, unified in real time.</p></div><div className="adm-clock"><span className="adm-live-dot"/> <span>LAST SYNC <b>{updatedTime}</b></span><button onClick={() => void refresh(true)} aria-label="Refresh overview"><Glyph name="target" size={17}/></button></div></div>

        {error && <div className="adm-banner-error" role="status">{error}<button onClick={() => void refresh(true)}>RETRY</button></div>}

        <section className="adm-stats" aria-label="National response statistics">
          <article className="adm-stat-card hot"><div className="adm-stat-head"><span>ACTIVE INCIDENTS</span><Glyph name="alert" size={15}/></div><div className="adm-stat-value">{String(stats.activeIncidents).padStart(2, '0')}<small> CASES</small></div><div className="adm-stat-foot"><b className="red-text">{stats.critical} CRITICAL</b><span>· live operations</span></div><div className="adm-spark red"><i style={{ height: '40%' }}/><i style={{ height: '60%' }}/><i style={{ height: '48%' }}/><i style={{ height: '70%' }}/><i style={{ height: '55%' }}/><i style={{ height: '82%' }}/><i style={{ height: '100%' }}/><i style={{ height: '76%' }}/><i style={{ height: '94%' }}/><i style={{ height: '66%' }}/></div></article>
          <article className="adm-stat-card"><div className="adm-stat-head"><span>FIELD UNITS</span><Glyph name="ambulance" size={15}/></div><div className="adm-stat-value">{String(stats.movingUnits).padStart(2, '0')}<small> / {stats.totalUnits} ACTIVE</small></div><div className="adm-stat-foot"><b className="green-text">{stats.readyUnits} READY</b><span>· fleet availability</span></div><div className="adm-stat-progress"><i style={{ width: `${stats.totalUnits ? (stats.movingUnits / stats.totalUnits) * 100 : 0}%` }}/></div></article>
          <article className="adm-stat-card"><div className="adm-stat-head"><span>HOSPITAL NETWORK</span><Glyph name="hospital" size={15}/></div><div className="adm-stat-value">{String(stats.hospitals).padStart(2, '0')}<small> FACILITIES</small></div><div className="adm-stat-foot"><b className="cyan-text">{stats.freeBeds.toLocaleString()} BEDS FREE</b><span>· {stats.beds.toLocaleString()} total</span></div><div className="adm-stat-progress cyan"><i style={{ width: `${stats.beds ? 100 - stats.freeBeds / stats.beds * 100 : 0}%` }}/></div></article>
          <button className={`adm-stat-card claim-stat ${stats && data.pending_claims.length ? 'attention' : ''}`} onClick={() => setPanel('claims')}><div className="adm-stat-head"><span>REGISTRY QUEUE</span><Glyph name="clock" size={15}/></div><div className="adm-stat-value">{String(data.pending_claims.length).padStart(2, '0')}<small> PENDING</small></div><div className="adm-stat-foot"><b className="amber-text">{data.pending_claims.length ? 'REVIEW REQUIRED' : 'ALL CLEAR'}</b><span>· hospital onboarding</span></div><span className="adm-stat-arrow"><Glyph name="arrow" size={16}/></span></button>
        </section>

        <section className="adm-main-grid">
          <div className="adm-map-panel"><div className="adm-panel-top"><div><p className="adm-eyebrow">GEOSPATIAL OVERVIEW <span>/ 27 GOVERNORATES</span></p><h2>National response map</h2></div><div className="adm-map-top-right"><span className="adm-map-status"><i/> LIVE TRACKING</span><button className="adm-square" onClick={() => void refresh(true)} aria-label="Refresh map"><span className={loading ? 'adm-spin' : ''}>↻</span></button></div></div>
            <LiveMap
              hospital={data.hospitals[0]}
              networkHospitals={data.hospitals}
              ambulances={data.ambulances}
              incidents={data.incidents}
              focus={selectedIncident}
              focusHospital={selectedHospital}
              onFocusCase={openIncident}
              onFocusHospital={setSelectedHospital}
              networkView
              visibleLayers={layers}
              onToggleLayer={toggleLayer}
            />
            <div className="adm-map-footer"><span><i className="legend-hospital"/> HOSPITALS <b>{data.hospitals.length}</b></span><span><i className="legend-incident"/> ACTIVE INCIDENTS <b>{data.incidents.length}</b></span><span><i className="legend-unit"/> FIELD UNITS <b>{stats.totalUnits}</b></span><span className="adm-map-credit">OSM · MAP DATA</span></div>
          </div>

          <aside className="adm-side-panel">
            <div className="adm-panel-head"><div><p className="adm-eyebrow">OPERATIONS FEED</p><h2>Situation room</h2></div><span className="adm-feed-live"><i/> LIVE</span></div>
            <nav className="adm-tabs" aria-label="Operations feed tabs">
              {([['incidents', 'Incidents'], ['network', 'Hospitals'], ['claims', 'Claims']] as [Panel, string][]).map(([tab, label]) => <button key={tab} className={panel === tab ? 'active' : ''} onClick={() => setPanel(tab)}>{label}<span>{tab === 'incidents' ? data.incidents.length : tab === 'network' ? data.hospitals.length : data.pending_claims.length}</span></button>)}
            </nav>
            <div className="adm-feed-scroll">
              {panel === 'incidents' && (filteredIncidents.length ? filteredIncidents.slice(0, 12).map((incident) => <button key={incident.alert_id} className={`adm-feed-item ${selectedIncident === incident.alert_id ? 'focused' : ''}`} onClick={() => void openIncident(incident.alert_id)}><span className={`adm-severity-mark ${incident.severity >= 8 ? 'critical' : incident.severity >= 5.5 ? 'serious' : 'moderate'}`}><Glyph name="alert" size={14}/></span><span className="adm-feed-copy"><b>{incident.location_label || incident.alert_id}</b><small>{incident.alert_id} · {incident.status.replace(/_/g, ' ')}</small><small>{incident.hospital_name || 'Unassigned'} · {ageLabel(incident.created_at)}</small></span><span className="adm-severity-score">{incident.severity.toFixed(1)}</span></button>) : <div className="adm-empty"><Glyph name="check" size={19}/><b>No active incidents</b><span>All quiet across the national network.</span></div>)}
              {panel === 'network' && (data.hospitals.length ? data.hospitals.map((hospital) => <button key={hospital.id} className={`adm-feed-item ${selectedHospital === hospital.id ? 'focused' : ''}`} onClick={() => setSelectedHospital(hospital.id)}><span className="adm-hospital-symbol"><Glyph name="hospital" size={15}/></span><span className="adm-feed-copy"><b>{hospital.name}</b><small>{hospital.address || hospital.location_label || 'Location confirmed'} · {hospital.trauma_level === 3 ? 'LEVEL III TRAUMA' : `TRAUMA LEVEL ${hospital.trauma_level}`}</small><small>{hospital.free_beds} beds free · {hospital.ambulances_available}/{hospital.ambulances_total} ambulances · {hospital.staff_count} staff</small></span><span className="adm-status-led"/></button>) : <div className="adm-empty"><b>No hospitals yet</b></div>)}
              {panel === 'claims' && (data.pending_claims.length ? data.pending_claims.map((claim) => <article className="adm-claim-card" key={claim.id}><div className="adm-claim-heading"><span className="adm-claim-tag">NEW REQUEST</span><small>{ageLabel(claim.created_at)}</small></div><b>{claim.name}</b><span className="adm-claim-place">{claim.governorate} Governorate · {claim.lat?.toFixed(4) ?? '—'}, {claim.lon?.toFixed(4) ?? '—'}</span><span className="adm-claim-detail">REQUESTED BY <b>{claim.claimed_by_name}</b> · <a href={`mailto:${encodeURIComponent(claim.claimed_by_email)}`}>{claim.claimed_by_email}</a></span>{claim.address && <span className="adm-claim-detail">ADDRESS · {claim.address}</span>}{claim.phone && <span className="adm-claim-detail">PHONE · {claim.phone}</span>}{claim.evidence && <p className="adm-claim-evidence">“{claim.evidence}”</p>}<div className="adm-claim-actions"><button disabled={working === claim.id} onClick={() => void decideClaim(claim.id, 'approve')} className="approve"><Glyph name="check" size={14}/> APPROVE</button><button disabled={working === claim.id} onClick={() => void decideClaim(claim.id, 'reject')} className="reject"><Glyph name="close" size={14}/> REJECT</button></div></article>) : <div className="adm-empty"><Glyph name="check" size={19}/><b>Registry queue clear</b><span>New hospital requests will appear here.</span></div>)}
            </div>
            <div className="adm-panel-bottom"><span>SHOWING <b>{shown}</b> RECORDS</span><span>REFRESH 5S</span></div>
          </aside>
        </section>

        {selected && <section className="adm-selected-strip"><span className="adm-selected-icon"><Glyph name="alert" size={16}/></span><div><small>SELECTED INCIDENT / {selected.alert_id}</small><b>{selected.location_label || `${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)}`}</b></div><span className="adm-selected-status">{selected.status.replace(/_/g, ' ')}</span><span className="adm-selected-sev">SEVERITY <b>{selected.severity.toFixed(1)}</b></span>{selected.hospital_name && selected.status !== 'at_hospital' && <button className="adm-action-button" disabled={actionBusy} onClick={() => void incidentAction('advance')}>ADVANCE</button>}{!['closed', 'cancelled', 'at_hospital'].includes(selected.status) && <button className="adm-action-button danger" disabled={actionBusy} onClick={() => void incidentAction('cancel')}>CANCEL</button>}<button onClick={() => setSelectedIncident(null)} aria-label="Clear selected incident"><Glyph name="close" size={17}/></button></section>}

        {selectedFacility && <section className="adm-facility-inspector"><div><span className="adm-selected-icon"><Glyph name="hospital" size={17}/></span><small>FACILITY CONTROL / {selectedFacility.registry_id ? `REGISTRY ${selectedFacility.registry_id}` : 'LEGACY RECORD'}</small><b>{selectedFacility.name}</b></div><label>BEDS TOTAL<input type="number" min="0" max="5000" defaultValue={selectedFacility.beds_total} key={`bed-${selectedFacility.id}-${selectedFacility.beds_total}`} id="adm-bed-total"/></label><label>FLEET SIZE<input type="number" min="0" max="200" defaultValue={selectedFacility.ambulances_total} key={`fleet-${selectedFacility.id}-${selectedFacility.ambulances_total}`} id="adm-fleet-total"/></label><label>READY UNITS<input type="number" min="0" max={selectedFacility.ambulances_total} defaultValue={selectedFacility.ambulances_available} key={`ready-${selectedFacility.id}-${selectedFacility.ambulances_available}`} id="adm-ready-total"/></label><button className="adm-action-button" disabled={actionBusy} onClick={() => void saveHospitalCapacity({ beds_total: Number((document.getElementById('adm-bed-total') as HTMLInputElement)?.value), ambulances_total: Number((document.getElementById('adm-fleet-total') as HTMLInputElement)?.value), ambulances_available: Number((document.getElementById('adm-ready-total') as HTMLInputElement)?.value) })}>APPLY NETWORK OVERRIDE</button><button className="adm-facility-close" onClick={() => setSelectedHospital(null)} aria-label="Close facility controls"><Glyph name="close" size={16}/></button></section>}

        <footer className="adm-footer"><span>CRASH RESPONSE PLATFORM <b>v3.0</b></span><span><i className={connected ? 'adm-live-dot' : 'adm-offline-dot'}/>{connected ? 'ALL SYSTEMS NOMINAL' : 'RECONNECTING TO NETWORK'}</span><span>EGYPT NATIONAL EMERGENCY GRID</span></footer>
      </div>
      <DetailSheet incident={caseDetails} onClose={() => setCaseDetails(null)} />
    </section>
  </main>;
}
