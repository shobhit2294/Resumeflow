let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (_) {
  nodemailer = null;
}

let transporter = null;

function getTransporter() {
  if (!nodemailer) return null;
  if (transporter) return transporter;

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!user || !pass) {
    console.warn('⚠️  SMTP_USER or SMTP_PASS is empty in .env — email will not be sent to your real inbox.');
    return null;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const isGmail = host.includes('gmail');

  if (isGmail) {
    // Gmail service preset is the most reliable for Nodemailer
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  } else {
    // Custom SMTP server (e.g. Brevo, SendGrid, Mailgun)
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  }

  return transporter;
}

/**
 * Send an OTP verification email to the user's real email inbox.
 */
async function sendOtpEmail(to, otp) {
  const t = getTransporter();

  if (!t) {
    console.log(`\n📧 [LOCAL DEV FALLBACK] OTP for ${to}: ${otp}`);
    console.log(`👉 To get this delivered directly to your real inbox, add your Gmail & App Password in .env\n`);
    return false;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; background: #6366f1; width: 44px; height: 44px; border-radius: 12px; line-height: 44px; text-align: center; color: #ffffff; font-size: 22px; font-weight: bold; margin-bottom: 12px;">⚡</div>
        <h1 style="color: #111827; margin: 0; font-size: 22px; font-weight: 700;">ResumeFlow</h1>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 13px;">Your Career & Application Workspace</p>
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <p style="color: #4b5563; font-size: 14px; margin: 0 0 16px;">Your one-time verification code is:</p>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #4f46e5; font-family: monospace;">${otp}</div>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center; margin: 0 0 20px;">
        This code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
      </p>

      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
      
      <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
        If you did not request this verification code, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    const info = await t.sendMail({
      from: `"ResumeFlow" <${process.env.SMTP_USER}>`,
      to,
      subject: `${otp} is your ResumeFlow verification code`,
      html,
    });
    console.log(`✅ Real OTP email dispatched to ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to deliver OTP email to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendOtpEmail };
