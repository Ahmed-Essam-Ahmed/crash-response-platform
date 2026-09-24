from .ml_model import CrashClassifier
from .rules import rule_detection
from .severity import score_severity, severity_by_impact_type

SCHEMA_VERSION = "1.0"
ML_VETO_THRESHOLD = 0.5
RESPONSE_WINDOW = 40


class DetectionPipeline:
    def __init__(self):
        self._ml = CrashClassifier()
        self._ml.load()

    def process_scenario(self, scenario, medical_risk=0.0):
        results = []
        for trip in scenario["trips"]:
            samples = trip["samples"]
            for i in range(0, len(samples) - RESPONSE_WINDOW, RESPONSE_WINDOW):
                window = samples[i:i + RESPONSE_WINDOW]
                detection = self._detect_window(window, trip["trip_id"], medical_risk)
                if detection and detection["detection"]["rule"]:
                    detection["expected"] = trip["label"] == "crash"
                    results.append(detection)
                    break
        return results

    def _detect_window(self, window, trip_id, medical_risk):
        rule = rule_detection(window)
        if not rule["fired"]:
            return None
        features = [rule["peak_g"], rule["delta_v_mps"],
                    rule["post_crash_inactive"] and 1 or 0]
        ml_conf = self._ml.predict_proba_crash(features)
        if ml_conf is not None and ml_conf < ML_VETO_THRESHOLD:
            return {"trip_id": trip_id, "detection": {"rule": False, "ml_confidence": round(ml_conf, 3)},
                    "suppressed_as": "near_miss"}
        h = 0.3 if ml_conf is None else ml_conf
        factors = {
            "peak_g": rule["peak_g"],
            "delta_v_mps": rule["delta_v_mps"],
            "speed_at_impact_mps": window[-1]["gps"]["speed_mps"] + rule["delta_v_mps"],
            "impact_type_weight": severity_by_impact_type(rule["impact_type"]),
            "post_crash_inactive": rule["post_crash_inactive"],
            "medical_risk": medical_risk,
        }
        severity, _ = score_severity(factors)
        return {
            "schema_version": SCHEMA_VERSION,
            "type": "crash_detected",
            "trip_id": trip_id,
            "t": window[-1]["t"],
            "location": {"lat": window[-1]["gps"]["lat"], "lon": window[-1]["gps"]["lon"]},
            "severity": severity,
            "factors": factors,
            "detection": {
                "rule": True,
                "ml_confidence": round(h, 3) if ml_conf is None else round(ml_conf, 3),
            },
        }