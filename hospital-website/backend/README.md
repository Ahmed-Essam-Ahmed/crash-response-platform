# Hospital Response Service

FastAPI service that owns the emergency response workflow.

## Architecture

```
app/
├── main.py            app + lifespan (seed registry, start background tasks)
├── config.py          env-driven settings
├── db.py              SQLAlchemy engine/session
├── migrations.py      additive schema reconciliation for existing databases
├── models.py          Hospital, RegistryHospital, HospitalClaim, StaffInvitation, …
├── serializers.py     model → dict for REST and WebSocket
├── realtime.py        WebSocket connection manager
├── deps.py            bearer auth, role gates, cross-tenant visibility
├── domain/            pure logic, no framework
│   ├── lifecycle.py   incident state machine + legal transitions
│   ├── triage.py      severity → destination + required resources
│   ├── geo.py         distance, ETA, interpolation
│   └── naming.py      hospital name normalisation for duplicate detection
├── services/          orchestration
│   ├── hospital_seed.py   starter registry of Egyptian hospitals
│   ├── hospital_registry.py  registry search + duplicate guard
│   ├── registry.py    seed demo hospitals/ambulances
│   ├── intake.py      crash report → incident (notify + dispatch)
│   ├── dispatch.py    hospital and ambulance selection, reserve/release
│   ├── progression.py background loop that advances incidents over time
│   ├── mail.py        SMTP delivery for invitations, console fallback
│   └── demo_source.py optional self-generating crash reports (DEMO_SOURCE=on)
├── routers/
│   ├── auth.py        registry lookup, join, claims, invitations, login
│   ├── cases.py       report a crash (X-Ingest-Key)
│   ├── me.py          this hospital's cases, fleet, beds
│   ├── geo.py         Nominatim search
│   └── stream.py      WebSocket /me/stream
scripts/
└── geocode_registry.py  resolve registry coordinates, never invent them
```

The domain layer has no FastAPI or SQLAlchemy imports, so the rules are testable in isolation.

## Incident lifecycle

```
detected → contacts_notified → ambulance_assigned → en_route_to_scene
        → on_scene → en_route_to_hospital → at_hospital → closed
```

`cancelled` is reachable from any state before `at_hospital`. Illegal transitions raise
`InvalidTransition` (409 on the API). Every transition is written to `incident_events`, giving the
incident a full audit timeline.

## Triage

| Severity | Destination | Ambulances | Trauma bay |
|----------|-------------|------------|------------|
| ≥ 8.0 | trauma_centre | 2 | yes |
| ≥ 5.5 | major | 1 | no |
| < 5.5 | minor | 1 | no |

Trauma cases only go to hospitals with `trauma_level >= 3`. Otherwise the nearest hospital with a
free bed wins; if none has beds, the nearest accepting hospital is used anyway.

## Hospital accounts

A hospital does not create itself by typing a name. It claims one row in
`registry_hospitals`, and a unique index on `hospitals.registry_id` means
that row can back at most one tenant. The guarantee is in the database, not
in a handler, so it holds across processes and against hand written SQL.

Three things a name is not, and why each is refused:

- **Not unique.** Egyptian hospital names repeat, and "Cairo University
  Hospital" typed by two people is still one hospital. So the same
  normalised name in another governorate, or a point within 200 m of a
  claimed hospital, is refused too.
- **Not a claim of capability.** The old endpoint let any caller declare a
  trauma level, which decides who gets the worst crashes.
- **Not a review shortcut.** Free text now creates a `hospital_claims` row
  for a human to review. It creates no tenant.

Staff join by invitation, not by an admin choosing their password. The
account does not exist until the recipient follows an emailed link and sets
their own password; the address comes from the invitation, never from the
request, so a forwarded link only works for someone who also receives mail
there.

Roles are enforced server side. Case actions need a dispatcher, capacity
changes and invitations need an admin, and a viewer can read but not act.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/registry` | Public registry search (`?q=`, `?governorate=`) |
| `POST` | `/auth/join` | Claim a registry entry, create the first admin |
| `POST` | `/auth/claims` | Request a hospital that is not listed, for review |
| `GET` | `/auth/review/claims` | List pending registry claims (`X-Review-Key`) |
| `POST` | `/auth/review/claims/{id}/approve` | Add an approved claim to the registry (`X-Review-Key`) |
| `POST` | `/auth/review/claims/{id}/reject` | Close a claim with an optional note (`X-Review-Key`) |
| `GET` | `/auth/review/overview` | National hospitals, active cases, fleet, and pending claims (`X-Review-Key`) |
| `PATCH` | `/auth/review/hospitals/{id}/capacity` | Override beds and fleet capacity (`X-Review-Key`) |
| `POST` | `/auth/review/incidents/{alert_id}/advance` | Advance a case across hospitals (`X-Review-Key`) |
| `POST` | `/auth/review/incidents/{alert_id}/cancel` | Cancel a case across hospitals (`X-Review-Key`) |
| `GET` | `/auth/invitations/{token}` | Preview an invitation before accepting |
| `POST` | `/auth/invitations/{token}/accept` | Set a password and create the account |
| `POST` | `/auth/login` | Exchange credentials for a token |
| `GET` | `/auth/me` | Current user and hospital |
| `POST` | `/auth/logout` | Revoke every session |
| `GET` | `/auth/staff` | Hospital team |
| `GET` | `/auth/staff/invitations` | Invitation history |
| `POST` | `/auth/staff/invitations` | Invite a colleague by email (admin) |
| `DELETE` | `/auth/staff/invitations/{id}` | Withdraw a pending invitation |
| `DELETE` | `/auth/staff/{user_id}` | Deactivate a colleague, revoking their sessions |
| `POST` | `/cases` | Report a crash → creates the incident and dispatches |
| `GET` | `/me/cases` | This hospital's cases and offers |
| `POST` | `/me/cases/{alert_id}/accept` | Take an offered case |
| `POST` | `/me/cases/{alert_id}/advance` | Move a case to its next state |
| `PATCH` | `/me/fleet` | Ambulance count and readiness (admin) |
| `PATCH` | `/me/beds` | Bed capacity (admin) |
| `GET` | `/geo/search` | Nominatim search |
| `WS` | `/me/stream` | Real-time event stream for this hospital |
| `GET` | `/health` | Liveness |

## Stream events

| Type | Emitted when |
|------|--------------|
| `incident_detected` | A crash is accepted, with the resources triage requires |
| `incident_status` | Any lifecycle transition |
| `fleet_update` | An assigned ambulance moves |
| `hospitals_update` | Occupancy changed |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///.../hospital-website/data/hospital.db` | Any SQLAlchemy URL |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `TIME_SCALE` | `8.0` | Time compression for the demo (higher = faster) |
| `DEMO_SOURCE` | `off` | `on` generates a crash report every 12s |
| `MAIL_SMTP_HOST` | unset | Unset means invitations are printed, not sent |
| `MAIL_SMTP_PORT` | `587` | SMTP port |
| `MAIL_SMTP_USER` / `MAIL_SMTP_PASSWORD` | unset | SMTP credentials |
| `MAIL_SMTP_STARTTLS` | `1` | `0` for a server that does not do STARTTLS |
| `MAIL_FROM` | `no-reply@<host>` | Envelope sender |
| `PUBLIC_WEB_URL` | `http://localhost:5173` | Base for invitation links |
| `INVITATION_TTL_HOURS` | `72` | How long an invitation stays valid |
| `REGISTRY_REVIEW_KEY` | unset | Enables national platform admin endpoints; send it as `X-Review-Key` |

Without `MAIL_SMTP_HOST` the invite response carries `mail_sent: false` and
the console shows the link to share by hand. It says so rather than
pretending, because a developer who believes mail went out will debug the
wrong thing.

Platform admin access is separate from hospital accounts. Set a private
`REGISTRY_REVIEW_KEY` to enable the national admin endpoints. The hospital
website serves the platform control room from the shared sign-in screen; the
administrator selects the `Platform admin` sign-in option. It uses that key to
load the national map and perform platform-level claim, capacity, and case
actions. An approved
claim creates a registry entry only; the requester still has to claim that
entry through `/auth/join` and become its first admin. A rejected claim is
closed with the review note. Both actions email the requester when SMTP is
configured; otherwise the API returns `mail_sent: false` and the decision is
still recorded.

## Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
python -m unittest discover -s tests -t .
```

## Registry coordinates

The seed deliberately ships without coordinates. Run the geocoder to fill
them in from Nominatim:

```bash
python scripts/geocode_registry.py --dry-run --limit 5   # look, change nothing
python scripts/geocode_registry.py                       # write what resolved
```

A candidate is only accepted when it is a facility, in the right governorate,
and shares a distinctive word with the name. That guard exists because
`type=hospital` alone accepted a Minya hospital for a Cairo entry, which
would have misrouted ambulances without anything looking wrong. Anything
unresolved is left for a human, and the join form asks that person for the
point instead.
