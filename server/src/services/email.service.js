import env from '../config/env.js';

/**
 * Send a 6-digit OTP email for password reset using Allysoft Email Service
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.name] - Recipient name
 * @param {string} params.otp - 6-digit random code
 */
export async function sendPasswordResetOtpEmail({ to, name, otp }) {
  const recipientName = name ? name.trim() : 'User';

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 13px;
      opacity: 0.85;
      margin-top: 6px;
      font-weight: 500;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .description {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .code-box {
      background-color: #f1f5f9;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .code-value {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #4f46e5;
      margin: 0;
    }
    .expiry-badge {
      display: inline-block;
      margin-top: 10px;
      font-size: 12px;
      font-weight: 600;
      color: #b45309;
      background-color: #fef3c7;
      padding: 4px 12px;
      border-radius: 9999px;
    }
    .security-note {
      border-left: 3px solid #6366f1;
      background-color: #eef2ff;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      line-height: 1.5;
      color: #3730a3;
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 28px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="brand-title">PrintPortal</h1>
        <p class="brand-subtitle">Apparel Merchandising & Production Network</p>
      </div>
      <div class="content">
        <h2 class="greeting">Hello, ${recipientName}</h2>
        <p class="description">
          We received a request to reset your password. Use the verification code below to complete your password reset:
        </p>

        <div class="code-box">
          <div class="code-label">Verification Code</div>
          <div class="code-value">${otp}</div>
          <div class="expiry-badge">⏱ Expires in 10 minutes</div>
        </div>

        <div class="security-note">
          <strong>Security Notice:</strong> If you did not initiate this password reset request, you can safely ignore this email. Your current password remains secure and active.
        </div>

        <p class="description" style="font-size: 12px; margin-bottom: 0;">
          For security reasons, never share this verification code with anyone. PrintPortal representatives will never ask for your code.
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} PrintPortal. All rights reserved.<br>
        This is an automated security transmission.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const url = env.EMAIL_SERVICE_URL;
  const headers = {
    'Content-Type': 'application/json',
    email: env.EMAIL_SERVICE_EMAIL,
    passkey: env.EMAIL_SERVICE_PASSKEY
  };

  const body = JSON.stringify({
    To: to,
    subject: `${otp} is your PrintPortal password reset code`,
    body: htmlBody
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[EmailService] Failed to send OTP to ${to}. Status: ${response.status}. Response: ${errorText}`);
    throw new Error(`Email delivery failed: ${errorText || 'Server error'}`);
  }

  const result = await response.json().catch(() => ({}));
  console.log(`[EmailService] OTP email sent successfully to ${to}. MessageId: ${result.messageId || 'ok'}`);
  return result;
}

export default {
  sendPasswordResetOtpEmail
};

