const nodemailer = require('nodemailer');

/**
 * FamilyHubs Direct Email Service
 * Sends clean, secure 6-digit verification OTP codes to Gmail and other mail providers.
 */

function getMailerConfig() {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_PASS || process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || (user && user.endsWith('@gmail.com') ? 'smtp.gmail.com' : undefined);
  const port = parseInt(process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? '465' : '587'), 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || (user ? `FamilyHubs Security <${user}>` : 'FamilyHubs <no-reply@familyhubs.in>');

  return { user, pass, host, port, secure, from };
}

let cachedTransporter = null;

function getTransporter() {
  const config = getMailerConfig();

  if (!config.user || !config.pass) {
    return null;
  }

  // Create transporter with connection pooling
  if (config.host === 'smtp.gmail.com' || (config.user && config.user.endsWith('@gmail.com') && !process.env.SMTP_HOST)) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.pass.replace(/\s+/g, ''), // strip accidental spaces in app passwords
      },
    });
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

/**
 * Verify SMTP configuration on boot
 */
async function verifyMailer() {
  const config = getMailerConfig();
  if (!config.user || !config.pass) {
    console.log('---------------------------------------------------------------');
    console.log('⚠️  [MAILER NOTICE] Live Gmail / SMTP credentials not found in .env');
    console.log('   To deliver real OTPs to Gmail inboxes, set in .env:');
    console.log('   EMAIL_USER=your_gmail@gmail.com');
    console.log('   EMAIL_PASS=your_16_digit_google_app_password');
    console.log('---------------------------------------------------------------');
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log(`[MAILER] ✅ SMTP connection verified for ${config.user}. Ready to dispatch live OTP emails to Gmail.`);
    return true;
  } catch (err) {
    console.error(`[MAILER WARN] SMTP connection verification failed (${err.message}). Check EMAIL_USER and EMAIL_PASS.`);
    return false;
  }
}

/**
 * Dispatch 6-digit OTP code directly to user's email inbox
 */
async function sendOtpEmail({ to, otpCode, action = 'LOGIN', role = 'CLIENT' }) {
  if (!to || !otpCode) {
    return { success: false, error: 'Recipient email and OTP code are required.' };
  }

  const cleanTo = to.trim().toLowerCase();
  const config = getMailerConfig();
  const transporter = getTransporter();

  const isSignup = action.toUpperCase() === 'SIGNUP';
  const roleLabel = role.toUpperCase() === 'PARTNER' ? 'Field Partner' : 'Family Client';
  const actionLabel = isSignup ? 'Activate Your Account' : 'Sign-In Verification';
  const subject = isSignup
    ? `FamilyHubs - Your Account Activation Code: ${otpCode}`
    : `FamilyHubs - Your Login Verification Code: ${otpCode}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); border-bottom: 1px solid #1e293b;">
              <div style="display: inline-block; padding: 10px 18px; background-color: #4f46e5; border-radius: 12px; margin-bottom: 12px;">
                <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">FamilyHubs</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Enterprise Managed Concierge for Aging Parents in India
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
                ${actionLabel}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1; text-align: center;">
                ${isSignup 
                  ? `Welcome to FamilyHubs! Please enter this 6-digit verification code to activate your <strong>${roleLabel}</strong> account.` 
                  : `A login attempt was requested for your <strong>${roleLabel}</strong> account. Enter this 6-digit code to complete sign-in.`}
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #020617; border: 2px dashed #6366f1; border-radius: 14px; padding: 24px; text-align: center; margin: 0 0 24px 0;">
                <div style="font-size: 11px; text-transform: uppercase; tracking: 1.5px; font-weight: 700; color: #818cf8; margin-bottom: 8px;">
                  Your 6-Digit Verification Code
                </div>
                <div style="font-size: 42px; font-weight: 800; letter-spacing: 12px; color: #ffffff; font-family: 'Courier New', Courier, monospace; margin-left: 12px;">
                  ${otpCode}
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
                  ⏱️ Valid for <strong>10 minutes</strong> only
                </div>
              </div>

              <!-- Security Information -->
              <div style="background-color: #1e293b; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  🔒 <strong>Security Notice:</strong> No links to click. Just enter the 6-digit code in your FamilyHubs browser screen. Never share this code with anyone. FamilyHubs staff will never ask for your code.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
                If you did not make this request, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} FamilyHubs Platform India. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const textContent = `
FamilyHubs ${actionLabel}

Your 6-digit verification code is: ${otpCode}

Valid for 10 minutes.
Enter this code in your FamilyHubs browser screen to ${isSignup ? 'activate your account' : 'complete sign-in'}.

No links to click. Never share this code with anyone.
  `.trim();

  // If no SMTP configured, log clearly and return structured result
  if (!transporter) {
    console.log(`[MAILER] ⚠️ Live SMTP not configured. OTP [${otpCode}] generated for ${cleanTo}`);
    return {
      success: false,
      configured: false,
      otpCode,
      message: 'SMTP credentials not configured in .env (add EMAIL_USER and EMAIL_PASS to deliver to Gmail).',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: cleanTo,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[MAILER] ✅ Real OTP [${otpCode}] successfully sent to Gmail (${cleanTo}) [MessageId: ${info.messageId}]`);
    return {
      success: true,
      configured: true,
      messageId: info.messageId,
      to: cleanTo,
    };
  } catch (err) {
    console.error(`[MAILER ERROR] Failed to send email to ${cleanTo}:`, err.message);
    return {
      success: false,
      configured: true,
      error: err.message,
      message: `Failed to deliver email: ${err.message}`,
    };
  }
}

module.exports = {
  getMailerConfig,
  verifyMailer,
  sendOtpEmail,
};
