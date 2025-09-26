# backend/mailer.py
import os
import smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")   # your gmail address
SMTP_PASS = os.getenv("SMTP_PASS")   # app password (NOT your normal password)
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USER or "no-reply@example.com")

def send_otp_email(to_email: str, code: str):
    """
    Send the OTP code to the user's email. If SMTP is not configured,
    fall back to printing the OTP to the console so you can test locally.
    """
    if not (SMTP_USER and SMTP_PASS):
        print(f"[DEV] OTP for {to_email}: {code}")
        return

    msg = EmailMessage()
    msg["Subject"] = "Your Aspect OTP Code"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Your OTP code is: {code}\n\nIt expires in 10 minutes.\n"
        "If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)
