def score_severity(factors):
    runs = [
        (factors.get("peak_g", 0.0), 12.0, 0.30),
        (factors.get("delta_v_mps", 0.0), 20.0, 0.25),
        (factors.get("speed_at_impact_mps", 0.0), 25.0, 0.15),
        (factors.get("impact_type_weight", 0.5), 1.0, 0.10),
    ]
    raw = sum(min(max(v, 0.0) / cap, 1.0) * w for v, cap, w in runs)
    if factors.get("post_crash_inactive"):
        raw += 0.15
    raw += factors.get("medical_risk", 0.0)
    return round(min(max(raw, 0.0), 1.0) * 10.0, 1), raw


def severity_by_impact_type(impact_type):
    weights = {"frontal": 0.8, "rear": 0.4, "side": 0.7, "rollover": 1.0}
    return weights.get(impact_type, 0.5)