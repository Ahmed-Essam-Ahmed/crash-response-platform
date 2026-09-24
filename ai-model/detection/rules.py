PEAK_G_THRESHOLD = 4.0
DELTA_V_THRESHOLD_MPS = 5.0
INACTIVITY_S = 3.0


def peak_g(window):
    return max(s["accel"]["g"] for s in window) if window else 0.0


def delta_v(window):
    if len(window) < 2:
        return 0.0
    v0 = window[0]["gps"]["speed_mps"]
    v1 = window[-1]["gps"]["speed_mps"]
    return v0 - v1


def impact_type(window):
    peak = max(window, key=lambda s: s["accel"]["g"])
    if abs(peak["accel"]["x"]) > abs(peak["accel"]["y"]):
        return "frontal" if peak["accel"]["x"] < 0 else "rear"
    return "side"


def post_crash_inactive(window):
    tail = window[-(max(1, int(INACTIVITY_S / (window[1]["t"] - window[0]["t"])))):]
    return all(s["gps"]["speed_mps"] < 0.5 for s in tail)


def rule_detection(sensor_window):
    if not sensor_window:
        return None
    g = peak_g(sensor_window)
    dv = delta_v(sensor_window)
    if g >= PEAK_G_THRESHOLD and dv >= DELTA_V_THRESHOLD_MPS:
        return {
            "fired": True,
            "peak_g": round(g, 2),
            "delta_v_mps": round(dv, 2),
            "impact_type": impact_type(sensor_window),
            "post_crash_inactive": post_crash_inactive(sensor_window),
        }
    return {"fired": False, "peak_g": round(g, 2), "delta_v_mps": round(dv, 2)}