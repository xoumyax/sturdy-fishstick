from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .config import Config
    from .models.job import Job

logger = logging.getLogger(__name__)


def _build_ical(job: "Job") -> bytes:
    try:
        from icalendar import Calendar, Event, vText
    except ImportError:
        return b""

    cal = Calendar()
    cal.add("prodid", "-//Sturdy Fishstick//EN")
    cal.add("version", "2.0")

    event = Event()
    event.add("summary", vText(f"Apply: {job.title}" + (f" at {job.company}" if job.company else "")))
    event.add("dtstart", datetime.now(timezone.utc) + timedelta(days=1))
    event.add("dtend", datetime.now(timezone.utc) + timedelta(days=1, hours=1))
    event.add("description", vText(
        f"Score: {job.match_score}/10\n"
        f"{job.match_reason or ''}\n\n"
        f"Apply: {job.url}"
    ))
    event.add("url", vText(job.url))
    cal.add_component(event)
    return cal.to_ical()


def send_opportunity_email(job: "Job", cfg: "Config") -> bool:
    ecfg = cfg.notifications.email
    if not ecfg.enabled or not ecfg.to or not ecfg.from_addr:
        return False
    if not cfg.smtp_app_password:
        logger.warning("SMTP_APP_PASSWORD not set — skipping email")
        return False

    score_str = f"{job.match_score:.0f}/10" if job.match_score is not None else "?"
    subject = f"🎯 Sturdy Fishstick: {score_str} match — {job.title}"
    if job.company:
        subject += f" at {job.company}"

    html_body = f"""
<html><body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
  <div style="background: #097C87; padding: 20px; border-radius: 12px 12px 0 0;">
    <h2 style="color: white; margin: 0;">🎯 High-Priority Opportunity</h2>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h3 style="margin: 0 0 4px; color: #097C87;">{job.title}</h3>
    {f'<p style="margin: 0 0 16px; color: #64748b;">{job.company}' + (f' · {job.location}' if job.location else '') + '</p>' if job.company else ''}
    <div style="background: #f0fafa; border-left: 4px solid #23CED9; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
      <strong>Match score: {score_str}</strong><br/>
      {job.match_reason or ''}
    </div>
    <a href="{job.url}" style="display: inline-block; background: #097C87; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold;">View & Apply →</a>
    <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Sent by Sturdy Fishstick · <a href="http://localhost:5173" style="color: #097C87;">Open Dashboard</a></p>
  </div>
</body></html>
"""

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = ecfg.from_addr
    msg["To"] = ecfg.to

    msg.attach(MIMEText(html_body, "html"))

    # iCal attachment
    ical_bytes = _build_ical(job)
    if ical_bytes:
        part = MIMEBase("text", "calendar", method="REQUEST")
        part.set_payload(ical_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename="reminder.ics")
        msg.attach(part)

    try:
        with smtplib.SMTP(ecfg.smtp_host, ecfg.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(ecfg.from_addr, cfg.smtp_app_password)
            server.sendmail(ecfg.from_addr, ecfg.to, msg.as_string())
        logger.info("Notification email sent for job: %s", job.title)
        return True
    except Exception as e:
        logger.error("Failed to send email for job %r: %s", job.title, e)
        return False


def send_opportunity_notifications(jobs: list["Job"], cfg: "Config") -> None:
    ecfg = cfg.notifications.email
    if not ecfg.enabled:
        return

    threshold = ecfg.score_threshold
    cutoff = datetime.utcnow() - timedelta(days=7)

    for job in jobs:
        if job.match_score is None or job.match_score < threshold:
            continue
        if job.status != "new":
            continue
        if job.date_posted and job.date_posted < cutoff:
            continue
        send_opportunity_email(job, cfg)
