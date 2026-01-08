/**
 * Email Functionality Test Script
 * Run with: node test-email.js
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🔧 Testing Email Configuration...\n');

  // Read SMTP config
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  };

  console.log('Config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    password: config.password ? '***' + config.password.slice(-4) : 'NOT SET',
  });

  // Validate
  if (!config.host || !config.user || !config.password) {
    console.error('❌ Missing SMTP configuration in .env.local');
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  // Test connection
  try {
    console.log('\n📡 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Send test email
  try {
    console.log('\n📧 Sending test email...');
    const info = await transporter.sendMail({
      from: `"Marketplace Test" <${config.from}>`,
      to: config.user,
      subject: 'Test Email - Marketplace',
      html: `
        <h2>✅ Email Service Working!</h2>
        <p>Your email configuration is correct.</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>SMTP Host:</strong> ${config.host}</p>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log(`\n📬 Check your inbox at: ${config.user}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }
}

testEmail();