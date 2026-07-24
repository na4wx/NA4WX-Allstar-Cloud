import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../config/env.js";

// The transport is created lazily (and cached) rather than at module
// load, so importing this file never fails even if SMTP isn't
// configured -- only actually sending does, and that's guarded below.
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

// sendPasswordResetEmail is the one place POST /forgot-password
// (auth.routes.ts) sends mail. If SMTP_HOST isn't configured, this
// logs the link instead of sending it and returns normally rather than
// throwing -- matches env.ts's own "optional feature, not load-bearing"
// precedent for Piper TTS: a cloud instance that hasn't set up SMTP
// yet shouldn't have its whole auth router break because of it, and a
// developer running this locally can still grab the link from stdout.
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!env.smtpHost) {
    console.warn(`SMTP not configured -- would have sent a password reset email to ${to}: ${resetUrl}`);
    return;
  }
  await getTransporter().sendMail({
    from: env.smtpFrom,
    to,
    subject: "Reset your NA4WX Allstar Cloud password",
    text:
      "Someone (hopefully you) asked to reset the password on this account.\n\n" +
      `Reset it here (valid for 1 hour):\n${resetUrl}\n\n` +
      "If you didn't request this, you can safely ignore this email -- your password won't change.",
  });
}
