import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SimpleEmailService {
  private readonly logger = new Logger(SimpleEmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST') || 'smtp.gmail.com',
      port: parseInt(this.configService.get('MAIL_PORT') || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const verificationLink = `${appUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Verify Your Email - ${appName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f4f4;
                }
                .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background: white;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
                }
                .header h1 {
                  margin: 0;
                  font-size: 28px;
                  font-weight: 600;
                }
                .content {
                  padding: 40px 30px;
                }
                .content h2 {
                  margin-top: 0;
                  color: #333;
                  font-size: 24px;
                }
                .content p {
                  margin: 16px 0;
                  color: #666;
                  font-size: 16px;
                }
                .button {
                  display: inline-block;
                  padding: 14px 32px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 24px 0;
                  transition: transform 0.2s;
                }
                .button:hover {
                  transform: translateY(-2px);
                }
                .footer {
                  padding: 30px;
                  text-align: center;
                  background: #f8f9fa;
                  color: #666;
                  font-size: 14px;
                  border-top: 1px solid #e9ecef;
                }
                .footer a {
                  color: #667eea;
                  text-decoration: none;
                }
                .divider {
                  border: 0;
                  border-top: 1px solid #e9ecef;
                  margin: 24px 0;
                }
                .link-fallback {
                  word-break: break-all;
                  color: #667eea;
                  font-size: 14px;
                  margin-top: 16px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📧 ${appName}</h1>
                </div>
                <div class="content">
                  <h2>Verify Your Email Address</h2>
                  <p>Thank you for registering! To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
                  
                  <div style="text-align: center;">
                    <a href="${verificationLink}" class="button">Verify Email Address</a>
                  </div>
                  
                  <hr class="divider">
                  
                  <p style="font-size: 14px; color: #666;">
                    If the button doesn't work, copy and paste this link into your browser:
                  </p>
                  <p class="link-fallback">${verificationLink}</p>
                  
                  <p style="font-size: 14px; color: #999; margin-top: 24px;">
                    <strong>Note:</strong> This verification link will expire in 24 hours. If you didn't create an account with ${appName}, you can safely ignore this email.
                  </p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                  <p>
                    Need help? <a href="${appUrl}/contact">Contact Support</a>
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Verify Your Email - ${appName}

Thank you for registering! To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with ${appName}, you can safely ignore this email.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
        `,
      });

      this.logger.log(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Password Reset Request - ${appName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>Password Reset Request</h2>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <p><a href="${resetLink}" class="button">Reset Password</a></p>
                <p>Or copy this link: ${resetLink}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendOrderDeliveredEmail(email: string, orderNumber: string, orderId: string, customerName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const reviewLink = `${appUrl}/orders/${orderId}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Your Order #${orderNumber} Has Been Delivered! - ${appName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  background-color: #f4f4f4;
                }
                .container {
                  max-width: 600px;
                  margin: 40px auto;
                  background: white;
                  border-radius: 8px;
                  overflow: hidden;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  padding: 40px 20px;
                  text-align: center;
                  color: white;
                }
                .header h1 {
                  margin: 0;
                  font-size: 28px;
                  font-weight: 600;
                }
                .icon {
                  font-size: 48px;
                  margin-bottom: 10px;
                }
                .content {
                  padding: 40px 30px;
                }
                .content h2 {
                  margin-top: 0;
                  color: #333;
                  font-size: 24px;
                }
                .content p {
                  margin: 16px 0;
                  color: #666;
                  font-size: 16px;
                }
                .order-info {
                  background: #f8f9fa;
                  padding: 20px;
                  border-radius: 6px;
                  margin: 24px 0;
                  border-left: 4px solid #10b981;
                }
                .order-info strong {
                  color: #333;
                  font-size: 18px;
                }
                .button {
                  display: inline-block;
                  padding: 14px 32px;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white !important;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 24px 0;
                  transition: transform 0.2s;
                }
                .button:hover {
                  transform: translateY(-2px);
                }
                .feedback-section {
                  background: #fffbeb;
                  padding: 20px;
                  border-radius: 6px;
                  margin: 24px 0;
                  border: 1px solid #fbbf24;
                }
                .feedback-section h3 {
                  margin-top: 0;
                  color: #92400e;
                  font-size: 18px;
                }
                .footer {
                  padding: 30px;
                  text-align: center;
                  background: #f8f9fa;
                  color: #666;
                  font-size: 14px;
                  border-top: 1px solid #e9ecef;
                }
                .footer a {
                  color: #10b981;
                  text-decoration: none;
                }
                .divider {
                  border: 0;
                  border-top: 1px solid #e9ecef;
                  margin: 24px 0;
                }
                .stars {
                  font-size: 24px;
                  color: #fbbf24;
                  letter-spacing: 4px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="icon">📦✅</div>
                  <h1>${appName}</h1>
                </div>
                <div class="content">
                  <h2>Your Order Has Been Delivered!</h2>
                  <p>Hi ${customerName},</p>
                  <p>Great news! Your order has been successfully delivered. We hope you're excited about your new purchase!</p>
                  
                  <div class="order-info">
                    <strong>Order #${orderNumber}</strong>
                  </div>
                  
                  <div class="feedback-section">
                    <h3>⭐ We'd Love Your Feedback!</h3>
                    <div class="stars">★★★★★</div>
                    <p>Your opinion matters! Help other shoppers by sharing your experience with this product. It only takes a minute.</p>
                    
                    <div style="text-align: center;">
                      <a href="${reviewLink}" class="button">Write a Review</a>
                    </div>
                  </div>
                  
                  <hr class="divider">
                  
                  <p style="font-size: 14px; color: #666;">
                    <strong>Why review?</strong>
                  </p>
                  <ul style="color: #666; font-size: 14px;">
                    <li>Help other customers make informed decisions</li>
                    <li>Share your experience with the community</li>
                    <li>Help vendors improve their products and service</li>
                  </ul>
                  
                  <p style="font-size: 14px; color: #999; margin-top: 24px;">
                    Thank you for shopping with us! We appreciate your business and look forward to serving you again.
                  </p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                  <p>
                    <a href="${appUrl}/orders">View Your Orders</a> |
                    <a href="${appUrl}/contact">Contact Support</a>
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `
Your Order Has Been Delivered! - ${appName}

Hi ${customerName},

Great news! Your order #${orderNumber} has been successfully delivered.

We'd love to hear your feedback! Please take a moment to review your purchase:
${reviewLink}

Your review helps other customers make informed decisions and helps vendors improve their products and service.

Thank you for shopping with us!

© ${new Date().getFullYear()} ${appName}. All rights reserved.
        `,
      });

      this.logger.log(`Order delivered email sent to ${email} for order ${orderNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send order delivered email to ${email}:`, error);
      // Don't throw error - email failure shouldn't block order status update
      return false;
    }
  }
}
