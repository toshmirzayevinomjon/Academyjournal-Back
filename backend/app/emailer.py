import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def _smtp_port() -> int:
    try:
        return int(_env("SMTP_PORT", "587"))
    except ValueError:
        return 587


def email_configured() -> bool:
    return bool(_env("SMTP_HOST") and _env("SMTP_USER"))


def send_email(to: str, subject: str, html: str) -> bool:
    if not email_configured():
        logger.warning(f"[EMAIL DEV MODE] To: {to} | Subject: {subject} | {html}")
        return False
    smtp_user = _env("SMTP_USER")
    smtp_from = _env("SMTP_FROM") or smtp_user
    msg = MIMEMultipart("alternative")
    msg["From"] = smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        with smtplib.SMTP(_env("SMTP_HOST"), _smtp_port(), timeout=15) as server:
            server.starttls()
            server.login(smtp_user, _env("SMTP_PASSWORD"))
            server.sendmail(smtp_from, [to], msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"Email send failed: {e}")
        return False
