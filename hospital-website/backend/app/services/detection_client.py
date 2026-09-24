import sys
from pathlib import Path


def _detection_module():
    root = Path(__file__).resolve().parents[4]
    engine = root / "ai-model"
    if str(engine) not in sys.path:
        sys.path.insert(0, str(engine))
    try:
        from detection.pipeline import DetectionPipeline  # type: ignore
        from detection.rules import rule_detection  # type: ignore
        return DetectionPipeline, rule_detection
    except ImportError:
        return None, None


def detect_window(sensor_window):
    pipeline, rules = _detection_module()
    if pipeline is None:
        return None
    rule = rules(sensor_window)
    if not rule["fired"]:
        return None
    return pipeline()._detect_window(sensor_window,
                                     trip_id=sensor_window[0]["trip_id"], medical_risk=0.0)