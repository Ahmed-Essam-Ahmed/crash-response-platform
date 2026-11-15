import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from .config import PASSWORD_ITERATIONS, TOKEN_TTL_HOURS

# Hospital accounts all carry the single `staff` role. Sensitive changes are
# not a separate role but a per-hospital admin password checked at the moment
# of the change, so there is no intra-hospital hierarchy to rank.
ROLES = ("authority", "staff")


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return salt.hex(), digest.hex()


def verify_password(password: str, salt_hex: str, expected_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected_hex)


def new_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS)


def token_matches(raw: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_token(raw), stored_hash)
