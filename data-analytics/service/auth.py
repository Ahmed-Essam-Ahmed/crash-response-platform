"""Token verification against the hospital database.

The analytics service remains separate but integrated: it reuses the auth
tokens issued by `hospital-website`. The implementation reads SQLite directly
so no dependency on the hospital backend is required.
"""

import hashlib
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional


class AuthError(Exception):
    def __init__(self, detail: str = "unauthorised"):
        self.detail = detail
        super().__init__(detail)


class CurrentUser:
    def __init__(self, user_id: int, email: str, role: str):
        self.user_id = user_id
        self.email = email
        self.role = role


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_current_user(
    token: str | None,
    db_path: str | Path,
    allowed_roles: tuple[str, ...],
) -> CurrentUser:
    if not token:
        raise AuthError("missing bearer token")
    token_hash = _hash_token(token)
    path = Path(db_path)
    if not path.exists():
        raise AuthError("database not found")

    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        rec = con.execute(
            """
            SELECT auth_tokens.user_id, auth_tokens.expires_at, auth_tokens.revoked_at,
                   users.email, users.role, users.is_active
            FROM auth_tokens
            JOIN users ON users.id = auth_tokens.user_id
            WHERE auth_tokens.token_hash = ?
            LIMIT 1
            """,
            (token_hash,),
        ).fetchone()
        if rec is None:
            raise AuthError("invalid token")
        if rec["revoked_at"] is not None:
            raise AuthError("token revoked")
        if rec["expires_at"]:
            try:
                expires = datetime.fromisoformat(str(rec["expires_at"]).replace("Z", "+00:00")).replace(tzinfo=None)
            except Exception:
                expires = None
            if expires is not None and expires <= datetime.utcnow():
                raise AuthError("token expired")
        if not rec["is_active"]:
            raise AuthError("user inactive")
        role = str(rec["role"] or "")
        if allowed_roles and role not in allowed_roles:
            raise AuthError("insufficient permissions")
        return CurrentUser(user_id=int(rec["user_id"]), email=str(rec["email"]), role=role)
    finally:
        con.close()
