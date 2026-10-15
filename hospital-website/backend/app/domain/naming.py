"""Name normalisation for detecting duplicate hospital records.

Two people registering the same hospital will not type the same string.
"Cairo University Hospital", "cairo university hospital", "جامعة القاهرة
مستشفى" and "Cairo Univ. Hospital" are all the same place, and the registry
has to collapse them to notice.

The bias here is deliberate. Folding orthographic variants of the same
letter is safe because it cannot turn two different names into one. Folding
*words* is not: "Al-Nahra Hospital" and "Nahra Hospital" may be two
branches or one hospital with a nickname, and guessing wrong either merges
two real hospitals or hides a duplicate from review. So only characters and
punctuation are folded, never words.
"""

import re
import unicodedata

_TATWEEL = "ـ"
_IGNORABLE = re.compile(r"[\u064b-\u0652\u0670\u0640]")
_SEPARATORS = re.compile(r"[\s\-_/\\.,()\[\]{}'\"|&+]+")

# Orthographic variants of the same Arabic letter. Written as a mapping to
# one representative so "أحمد" and "احمد" collapse, but nothing else moves.
_ARABIC_FOLD = {
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ئ": "ي",
    "ة": "ه",
    "ؤ": "و",
}

# Tokens that are abbreviations of a word already spelled out elsewhere.
# Whole-token only, so "max" is never touched inside "maximum".
_ABBREVIATIONS = {
    "hosp": "hospital",
    "hospitals": "hospital",
    "hosp.": "hospital",
    "univ": "university",
    "university hosp": "university hospital",
    "gen": "general",
    "genl": "general",
    "comm": "community",
    "community": "community",
    "spec": "specialized",
    "specialized": "specialized",
    "specialised": "specialized",
    "univ.": "university",
    "h": "hospital",
}

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def normalize(name: str) -> str:
    """Fold a hospital name to the form duplicates are detected on."""
    if not name:
        return ""

    text = unicodedata.normalize("NFKC", name).strip().lower()
    text = text.translate(_ARABIC_DIGITS)
    text = _IGNORABLE.sub("", text)
    text = "".join(_ARABIC_FOLD.get(ch, ch) for ch in text)

    tokens = []
    for raw in _SEPARATORS.split(text):
        if not raw:
            continue
        expanded = _ABBREVIATIONS.get(raw)
        if expanded:
            tokens.extend(expanded.split())
        else:
            tokens.append(raw)

    return " ".join(tokens)
