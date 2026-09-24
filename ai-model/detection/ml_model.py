import os


class CrashClassifier:
    MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

    def __init__(self):
        self.clf = None
        self.path = os.path.normpath(os.path.join(self.MODELS_DIR, "crash_veto.joblib"))

    def _sklearn(self):
        try:
            import joblib
            from sklearn.ensemble import RandomForestClassifier
            return RandomForestClassifier, joblib
        except ImportError as exc:
            raise ImportError("scikit-learn required for training; pip install -r requirements.txt") from exc

    def fit(self, X, y):
        RandomForestClassifier, _ = self._sklearn()
        clf = RandomForestClassifier(n_estimators=120, random_state=0)
        clf.fit(X, y)
        self.clf = clf
        return self

    def save(self):
        _, joblib = self._sklearn()
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        joblib.dump(self.clf, self.path)

    def load(self):
        if not os.path.exists(self.path):
            return False
        _, joblib = self._sklearn()
        self.clf = joblib.load(self.path)
        return True

    def predict_proba_crash(self, features):
        if self.clf is None:
            return None
        return float(self.clf.predict_proba([features])[0][1])