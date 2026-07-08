import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// MAILER — used exclusively to deliver one-time passcodes to the admin
// account during login. Configured via EMAIL_USER / EMAIL_APP_PASSWORD in
// .env (a Gmail address + a Gmail "App Password", NOT the account's normal
// password — generate one at https://myaccount.google.com/apppasswords).
// ---------------------------------------------------------------------------

const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD || "";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

if (EMAIL_USER && EMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
    // Fail fast instead of hanging the request indefinitely if the SMTP
    // connection can't be established (e.g. an egress firewall silently
    // drops the packets rather than rejecting the connection outright).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
} else {
  // Avoid noisy terminal output in dev when mailer isn't configured.
  // OTP endpoints will still return a clear 503 when used.
}


export function isMailerConfigured(): boolean {
  return transporter !== null;
}

/** Sends a one-time passcode to the admin's email address. */
export async function sendOtpEmail(toEmail: string, otp: string): Promise<void> {
  await sendEmail(
    toEmail,
    `Your Cinemax admin login code: ${otp}`,
    `Your one-time login code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Your admin login code", "Enter this code to finish signing in to the Cinemax admin panel.", otp)
  );
}

/** Sends a sign-up verification code. */
export async function sendSignupVerificationEmail(toEmail: string, otp: string): Promise<void> {
  await sendEmail(
    toEmail,
    `Verify your Cinemax account: ${otp}`,
    `Your verification code is ${otp}. It expires in 10 minutes.`,
    buildCodeEmailHtml("Verify your email", "Enter this code to complete your Cinemax sign-up.", otp)
  );
}

/** Sends a password reset link/token. */
export async function sendPasswordResetEmail(toEmail: string, resetToken: string, baseUrl: string): Promise<void> {
  const resetUrl = `${baseUrl}?reset=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(toEmail)}`;
  await sendEmail(
    toEmail,
    "Reset your Cinemax password",
    `Reset your password: ${resetUrl}`,
    `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background:#0a0a0a; border-radius: 16px; color:#fff;">
        <div style="width:40px;height:40px;border-radius:12px;background:#22c55e;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:20px;">C</div>
        <h2 style="margin: 20px 0 8px; font-size: 18px;">Reset your password</h2>
        <p style="color:#a3a3a3; font-size: 13px; margin-bottom: 24px;">Click the button below to choose a new password. This link expires in 10 minutes.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#22c55e;color:#000;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;">Reset Password</a>
        <p style="color:#525252; font-size: 11px; margin-top: 24px;">If you didn't request this, ignore this email.</p>
      </div>
    `
  );
}

function buildCodeEmailHtml(title: string, subtitle: string, otp: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; background:#0a0a0a; border-radius: 16px; color:#fff;">
      <div style="width:40px;height:40px;border-radius:12px;background:#22c55e;display:flex;align-items:center;justify-content:center;font-weight:900;color:#000;font-size:20px;">C</div>
      <h2 style="margin: 20px 0 8px; font-size: 18px;">${title}</h2>
      <p style="color:#a3a3a3; font-size: 13px; margin-bottom: 24px;">${subtitle} It expires in 10 minutes.</p>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; background:#141414; border:1px solid #262626; border-radius:12px; padding: 16px; text-align:center;">${otp}</div>
      <p style="color:#525252; font-size: 11px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendEmail(toEmail: string, subject: string, text: string, html: string): Promise<void> {
  if (!transporter) {
    throw new Error("Email delivery is not configured on the server.");
  }
  await transporter.sendMail({
    from: `"Cinemax" <${EMAIL_USER}>`,
    to: toEmail,
    subject,
    text,
    html,
  });
}
