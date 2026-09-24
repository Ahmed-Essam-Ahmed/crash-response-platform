import math

IMPACT_MS = 0.42
AFTERMATH_S = 3.0


def crash_signature(approach_speed_mps: float, severity: float, dt: float = 0.1):
    peak_g = 4.0 + severity * 0.8
    impact_dv = approach_speed_mps * (0.45 + severity * 0.08)
    samples = []
    t = 0.0
    speed = approach_speed_mps
    while t <= IMPACT_MS + AFTERMATH_S:
        if t <= IMPACT_MS:
            g = peak_g * math.sin(math.pi * t / IMPACT_MS)
            speed -= (impact_dv / IMPACT_MS) * dt
        else:
            g = 0.0
            speed = 0.0
        samples.append({
            "t": round(t, 3),
            "g": round(g, 3),
            "speed_mps": round(max(speed, 0.0), 3),
            "inactive_after_impact": t > IMPACT_MS,
        })
        t += dt
    return samples, {"peak_g": round(peak_g, 2), "delta_v_mps": round(impact_dv, 2)}


def near_miss_brake(speed_mps: float, duration_s: float = 1.5, dt: float = 0.1):
    samples = []
    t = 0.0
    while t <= duration_s:
        g = 0.55 + 0.3 * math.sin(math.pi * t / duration_s)
        samples.append({"t": round(t, 3), "g": round(g, 3),
                        "speed_mps": round(max(speed_mps - (speed_mps * 0.6) * (t / duration_s), 0.0), 3)})
        t += dt
    return samples