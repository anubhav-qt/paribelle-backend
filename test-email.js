const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

console.log('📧 Testing Email Configuration...\n');

const config = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '***' : undefined,
  SMTP_FROM: process.env.SMTP_FROM,
  APP_NAME: process.env.APP_NAME,
  APP_URL: process.env.APP_URL,
};

console.log('Configuration:');
console.log(JSON.stringify(config, null, 2));
console.log('');

if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
  console.error('❌ Missing SMTP configuration!');
  console.error('Required: SMTP_HOST, SMTP_USER, SMTP_PASSWORD');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function testEmail() {
  try {
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    console.log('📨 Sending test email...');
    const testEmail = process.env.SMTP_USER; // Send to yourself
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: testEmail,
      subject: `Test Email - Password Reset - ${process.env.APP_NAME || 'Marketplace'}`,
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from your marketplace backend.</p>
        <p><strong>SMTP Configuration is working!</strong></p>
        <p>Reset Link Example: <a href="${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=test123">Click Here</a></p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Recipient:', testEmail);
    console.log('\n🎉 Email service is working correctly!');
  } catch (error) {
    console.error('❌ Email test failed!');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    if (error.command) {
      console.error('Failed Command:', error.command);
    }
    process.exit(1);
  }
}

testEmail();
