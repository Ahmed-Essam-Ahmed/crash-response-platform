"""Outbound email.

An invitation is only meaningful if it reaches the address it was issued to,
so this has to work in a real deployment. It sends over SMTP when a host is
configured and prints to the console when one is not.

The fallback exists so a developer can complete an invite without an SMTP
server. It prints the link and says so, because a developer who believes
mail was sent and is not will spend a long time debugging the invitation
flow instead of the mail configuration.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from ..config import (
    MAIL_FROM,
    MAIL_FROM_NAME,
    MAIL_SMTP_HOST,
    MAIL_SMTP_PASSWORD,
    MAIL_SMTP_PORT,
    MAIL_SMTP_STARTTLS,
    MAIL_SMTP_TIMEOUT,
    MAIL_SMTP_USER,
)

log = logging.getLogger(__name__)


class MailError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(MAIL_SMTP_HOST)


def mask(address: str) -> str:
    """Reduce an address to something safe to show to a link holder.

    An invitation link is a bearer credential: whoever has it can read the
    invitation and, if they also have the inbox, redeem it. Masking means a
    link that leaks into a chat or a shared screen does not hand over the
    colleague's address on its own.
    """
    local, _, domain = address.partition("@")
    if not domain:
        return "***"
    if len(local) <= 2:
        head = local[:1]
    else:
        head = local[:2]
    return f"{head}{'*' * max(len(local) - len(head), 1)}@{domain}"


def send(to: str, subject: str, body: str) -> bool:
    """Send one message. Returns True if SMTP accepted it."""
    if not is_configured():
        _log_fallback(to, subject, body)
        return False
    _send_smtp(to, subject, body)
    return True


def _send_smtp(to: str, subject: str, body: str) -> None:
    message = EmailMessage()
    message["From"] = _from_header()
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(MAIL_SMTP_HOST, MAIL_SMTP_PORT, timeout=MAIL_SMTP_TIMEOUT) as server:
            if MAIL_SMTP_STARTTLS:
                server.starttls(context=ssl.create_default_context())
            if MAIL_SMTP_USER:
                server.login(MAIL_SMTP_USER, MAIL_SMTP_PASSWORD)
            server.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        log.warning("could not send mail to %s: %s", to, exc)
        raise MailError(str(exc)) from exc


def _from_header() -> str:
    address = MAIL_FROM or f"no-reply@{MAIL_SMTP_HOST}"
    return f"{MAIL_FROM_NAME} <{address}>" if MAIL_FROM_NAME else address


def _log_fallback(to: str, subject: str, body: str) -> None:
    log.warning(
        "MAIL_SMTP_HOST is not set, so this message was NOT sent. "
        "Configure SMTP to deliver it.\n--- %s ---\nTo: %s\n%s",
        subject,
        to,
        body,
    )
    print(f"\n{'=' * 70}\nMAIL (not sent, SMTP unconfigured)\nTo: {to}\n{subject}\n\n{body}\n{'=' * 70}\n")
