import argparse
import json
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE_URL = "http://localhost:8000"

CASES = [
    {
        "severity": 9.2,
        "severity_source": "ai",
        "severity_confidence": 0.91,
        "severity_summary": "High-speed frontal impact with entrapment and suspected internal bleeding.",
        "mechanism": "Head-on collision at a signalised junction. The driver was behind the wheel and trapped by the legs.",
        "location": {"lat": 30.0652, "lon": 31.2471},
        "location_label": "Corniche St near El Nile Bridge",
        "patient": {
            "name": "Mona Adel",
            "age": 34,
            "gender": "female",
            "blood_type": "O+",
            "conditions": ["Asthma"],
            "medications": ["Salbutamol inhaler"],
            "allergies": ["Penicillin"],
            "notes": "Complaining of chest pain and difficulty breathing. Conscious but confused.",
        },
        "emergency_contacts": [
            {"name": "Hala Fouad", "relation": "sister", "phone": "+201000000001", "email": "hala@example.com", "primary": True},
            {"name": "Karim Fouad", "relation": "brother", "phone": "+201000000002"},
        ],
        "impact_factors": {
            "impact_type": "frontal",
            "peak_g": 41.2,
            "delta_v_mps": 18.4,
            "speed_mps": 19.8,
            "occupants": 2,
            "secondary": True,
        },
    },
    {
        "severity": 6.4,
        "severity_source": "ai",
        "severity_confidence": 0.84,
        "severity_summary": "Rear-end collision, moderate injury, no entrapment reported.",
        "mechanism": "Rear-ended at a stop light. One passenger was thrown against the door and reports neck pain.",
        "location": {"lat": 30.0412, "lon": 31.2255},
        "location_label": "Ramses St, Semelmek",
        "patient": {
            "name": "Youssef Halim",
            "age": 27,
            "gender": "male",
            "blood_type": "A-",
            "conditions": [],
            "medications": [],
            "allergies": [],
            "notes": "Neck pain, no loss of consciousness. Walking and talking.",
        },
        "emergency_contacts": [
            {"name": "Rania Halim", "relation": "wife", "phone": "+201000000003", "email": "rania@example.com", "primary": True},
        ],
        "impact_factors": {
            "impact_type": "rear",
            "peak_g": 16.5,
            "delta_v_mps": 7.1,
            "speed_mps": 8.3,
            "occupants": 2,
            "secondary": False,
        },
    },
    {
        "severity": 3.1,
        "severity_source": "ai",
        "severity_confidence": 0.77,
        "severity_summary": "Low-speed side impact, minor injuries only.",
        "mechanism": "A van turned across the motorcycle lane at low speed. The rider fell and is walking, complaining of a bruised hip.",
        "location": {"lat": 30.0523, "lon": 31.2398},
        "location_label": "Tahrir St, Garden City",
        "patient": {
            "name": "Sara Nabil",
            "age": 22,
            "gender": "female",
            "blood_type": "B+",
            "conditions": [],
            "medications": [],
            "allergies": [],
            "notes": "Alert, ambulatory, pain on the left hip. Helmet intact.",
        },
        "emergency_contacts": [
            {"name": "Ahmed Nabil", "relation": "father", "phone": "+201000000004", "primary": True},
            {"name": "Mariam Nabil", "relation": "mother", "phone": "+201000000005"},
        ],
        "impact_factors": {
            "impact_type": "lateral",
            "peak_g": 6.8,
            "delta_v_mps": 2.9,
            "speed_mps": 4.1,
            "occupants": 1,
            "secondary": False,
        },
    },
    {
        "severity": 7.8,
        "severity_source": "ai",
        "severity_confidence": 0.88,
        "severity_summary": "Pedestrian struck by a vehicle, suspected pelvic injury.",
        "mechanism": "A pedestrian was struck by a car while crossing. The person is on the ground and cannot stand.",
        "location": {"lat": 30.0334, "lon": 31.2201},
        "location_label": "Ain Shams St underpass",
        "patient": {
            "name": "Unknown male, about 60",
            "age": 60,
            "gender": "male",
            "blood_type": "unknown",
            "conditions": ["Diabetes"],
            "medications": ["Metformin"],
            "allergies": [],
            "notes": "Conscious, breathing fast. Pain in the pelvis, unable to bear weight.",
        },
        "emergency_contacts": [
            {"name": "Halim Fahmy", "relation": "neighbour", "phone": "+201000000006", "primary": True},
        ],
        "impact_factors": {
            "impact_type": "lateral",
            "peak_g": 33.7,
            "delta_v_mps": 12.6,
            "speed_mps": 14.2,
            "occupants": 1,
            "secondary": True,
        },
    },
    {
        "severity": 4.6,
        "severity_source": "ai",
        "severity_confidence": 0.71,
        "severity_summary": "Multi-vehicle shunt, minor injuries, no entrapment.",
        "mechanism": "Three cars shunted on a wet road. Nobody is trapped; two people are shaken but alert.",
        "location": {"lat": 30.0587, "lon": 31.2602},
        "location_label": "Cairo-Suez Rd, Al Maadi",
        "patient": {
            "name": "Omar Zaki",
            "age": 45,
            "gender": "male",
            "blood_type": "AB+",
            "conditions": ["High blood pressure"],
            "medications": ["Amlodipine"],
            "allergies": [],
            "notes": "Minor bruising, no pain on movement. Seat belt held.",
        },
        "emergency_contacts": [
            {"name": "Nour Zaki", "relation": "daughter", "phone": "+201000000007", "email": "nour@example.com", "primary": True},
        ],
        "impact_factors": {
            "impact_type": "rear",
            "peak_g": 11.2,
            "delta_v_mps": 5.4,
            "speed_mps": 6.0,
            "occupants": 4,
            "secondary": False,
        },
    },
]


def post_case(api_key: str, body: dict) -> dict:
    request = urllib.request.Request(
        f"{BASE_URL}/cases",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Ingest-Key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", default="dev-ingest-key-change-me")
    parser.add_argument("--count", type=int, default=len(CASES))
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    for index, case in enumerate(CASES[: args.count]):
        body = dict(case)
        minutes_ago = (args.count - index) * 3
        body["occurred_at"] = (now - timedelta(minutes=minutes_ago)).isoformat().replace("+00:00", "Z")
        body["trip_id"] = f"trip-demo-{index + 1:02d}"
        try:
            created = post_case(args.api_key, body)
        except urllib.error.HTTPError as error:
            print(f"failed ({error.code}): {error.read().decode()[:200]}")
            continue
        print(f"{created['alert_id']}  severity {created['severity']}  {created['mechanism'][:60]}...")


if __name__ == "__main__":
    main()
