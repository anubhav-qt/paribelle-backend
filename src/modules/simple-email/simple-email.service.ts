import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SimpleEmailService {
  private readonly logger = new Logger(SimpleEmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const port = parseInt(this.configService.get('SMTP_PORT') || '587');
    const secure = this.configService.get('SMTP_SECURE') === 'true' || port === 465;
    
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST') || 'smtp.gmail.com',
      port: port,
      secure: secure, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
      connectionTimeout: 10000, // 10 seconds timeout
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const verificationLink = `${appUrl}/verify-email?token=${token}`;

    this.logger.log(`Attempting to send verification email to: ${email}`);
    this.logger.log(`SMTP Config - Host: ${this.configService.get('SMTP_HOST')}, Port: ${this.configService.get('SMTP_PORT')}, From: ${this.configService.get('SMTP_FROM')}`);

    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER'),
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

      this.logger.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
      this.logger.log(`Response: ${JSON.stringify(info.response)}`);
      this.logger.log(`Accepted: ${info.accepted}, Rejected: ${info.rejected}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to send verification email to ${email}:`, error.message);
      if (error.response) {
        this.logger.error(`SMTP Response: ${error.response}`);
      }
      if (error.responseCode) {
        this.logger.error(`Response Code: ${error.responseCode}`);
      }
      throw new Error('Failed to send verification email');
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

  async sendOrderConfirmationEmail(email: string, orderNumber: string, customerName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    
    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Order Confirmed #${orderNumber} - ${appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Order Confirmed!</h2>
            <p>Hi ${customerName},</p>
            <p>Your order <strong>#${orderNumber}</strong> has been confirmed and is being prepared for shipment.</p>
            <p>We'll send you another email when your order ships.</p>
            <p>Thank you for shopping with ${appName}!</p>
          </div>
        `,
      });
      this.logger.log(`Order confirmation email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send order confirmation email:`, error);
      return false;
    }
  }

  async sendOrderShippedEmail(email: string, orderNumber: string, customerName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    
    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Order Shipped #${orderNumber} - ${appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2196F3;">Order Shipped!</h2>
            <p>Hi ${customerName},</p>
            <p>Good news! Your order <strong>#${orderNumber}</strong> has been shipped and is on its way.</p>
            <p>You should receive it within the estimated delivery time.</p>
            <p>Thank you for your patience!</p>
          </div>
        `,
      });
      this.logger.log(`Order shipped email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send order shipped email:`, error);
      return false;
    }
  }

  async sendOrderCancelledEmail(email: string, orderNumber: string, customerName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    
    try {
      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject: `Order Cancelled #${orderNumber} - ${appName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f44336;">Order Cancelled</h2>
            <p>Hi ${customerName},</p>
            <p>Your order <strong>#${orderNumber}</strong> has been cancelled as requested.</p>
            <p>If you paid for this order, a credit note will be issued and refund will be processed within 5-7 business days.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>We hope to see you again soon!</p>
          </div>
        `,
      });
      this.logger.log(`Order cancelled email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send order cancelled email:`, error);
      return false;
    }
  }

  async sendInvoiceEmail(
    email: string,
    recipientName: string,
    subject: string,
    message: string,
    invoice: any,
  ) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // Read PDF file if exists
      let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      if (invoice.pdfUrl) {
        try {
          const pdfPath = path.join(process.cwd(), invoice.pdfUrl);
          const pdfBuffer = await fs.readFile(pdfPath);
          attachments.push({
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        } catch (error) {
          this.logger.warn(`Failed to read PDF file for invoice ${invoice.invoiceNumber}:`, error);
        }
      }

      const invoiceTypeLabel = this.getInvoiceTypeLabel(invoice.type);

      await this.transporter.sendMail({
        from: this.configService.get('MAIL_FROM') || this.configService.get('MAIL_USER'),
        to: email,
        subject,
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
                .invoice-info {
                  background: #f8f9fa;
                  padding: 20px;
                  border-radius: 6px;
                  margin: 24px 0;
                  border-left: 4px solid #667eea;
                }
                .invoice-info p {
                  margin: 8px 0;
                }
                .invoice-info strong {
                  color: #333;
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
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="icon">📄</div>
                  <h1>${appName}</h1>
                </div>
                <div class="content">
                  <h2>${invoiceTypeLabel}</h2>
                  
                  ${message}
                  
                  <div class="invoice-info">
                    <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
                    <p><strong>Invoice Date:</strong> ${this.formatDate(invoice.invoiceDate)}</p>
                    <p><strong>Due Date:</strong> ${this.formatDate(invoice.dueDate)}</p>
                    <p><strong>Total Amount:</strong> ${this.formatCurrency(invoice.total)}</p>
                    ${invoice.type === 'vendor' && invoice.payoutAmount ? 
                      `<p><strong>Payout Amount:</strong> ${this.formatCurrency(invoice.payoutAmount)}</p>` : ''}
                  </div>
                  
                  <hr class="divider">
                  
                  <p style="font-size: 14px; color: #666;">
                    The invoice is attached to this email as a PDF document. If you have any questions or concerns, please don't hesitate to contact us.
                  </p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                  <p>
                    <a href="${appUrl}/contact">Contact Support</a>
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
        attachments,
      });

      this.logger.log(`Invoice email sent to ${email} for invoice ${invoice.invoiceNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send invoice email to ${email}:`, error);
      throw new Error('Failed to send invoice email');
    }
  }

  private getInvoiceTypeLabel(type: string): string {
    switch (type) {
      case 'customer':
        return 'Invoice';
      case 'vendor':
        return 'Payout Statement';
      case 'platform':
        return 'Commission Invoice';
      default:
        return 'Invoice';
    }
  }

  private formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  }

  async sendPasswordResetEmail(email: string, token: string, firstName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER'),
        to: email,
        subject: `Reset Your Password - ${appName}`,
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
                }
                .warning-box {
                  background: #fff3cd;
                  border-left: 4px solid #ffc107;
                  padding: 16px;
                  margin: 24px 0;
                  border-radius: 4px;
                }
                .footer {
                  padding: 30px;
                  text-align: center;
                  background: #f8f9fa;
                  color: #666;
                  font-size: 14px;
                  border-top: 1px solid #e9ecef;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${appName}</h1>
                </div>
                <div class="content">
                  <h2>Reset Your Password</h2>
                  <p>Hi ${firstName},</p>
                  <p>We received a request to reset your password for your ${appName} account.</p>
                  <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
                  <center>
                    <a href="${resetLink}" class="button">Reset Password</a>
                  </center>
                  <div class="warning-box">
                    <strong>⚠️ Security Notice:</strong><br>
                    If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
                  </div>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="color: #667eea; word-break: break-all;">${resetLink}</p>
                </div>
                <div class="footer">
                  <p>This is an automated email from ${appName}. Please do not reply to this email.</p>
                  <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendReturnApprovalEmail(
    email: string,
    customerName: string,
    orderNumber: string,
    returnReason: string,
    returnAddress: {
      name: string;
      addressLine1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone: string;
    }
  ) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    
    // Generate comprehensive QR code data for shipping carriers (Amazon-style)
    const QRCode = require('qrcode');
    
    // Create a return authorization number
    const returnAuthNumber = `RMA-${orderNumber}-${Date.now().toString().slice(-6)}`;
    
    // Comprehensive QR data for carrier scanning
    const qrData = JSON.stringify({
      rma: returnAuthNumber,
      order: orderNumber,
      returnTo: {
        name: returnAddress.name,
        address: returnAddress.addressLine1,
        city: returnAddress.city,
        state: returnAddress.state,
        zip: returnAddress.postalCode,
        country: returnAddress.country,
        phone: returnAddress.phone
      },
      shipmentType: 'RETURN',
      service: 'GROUND',
      timestamp: new Date().toISOString(),
      trackingUrl: `${appUrl}/orders/return/${returnAuthNumber}`
    });
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { 
      width: 300, 
      margin: 2,
      errorCorrectionLevel: 'H' // High error correction for better scanning
    });

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER'),
        to: email,
        subject: `Return Approved - Order #${orderNumber}`,
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
                .info-box {
                  background: #f0fdf4;
                  border-left: 4px solid #10b981;
                  padding: 16px;
                  margin: 24px 0;
                  border-radius: 4px;
                }
                .info-box strong {
                  color: #059669;
                }
                .return-label {
                  background: #f9fafb;
                  border: 2px dashed #d1d5db;
                  padding: 24px;
                  margin: 24px 0;
                  border-radius: 8px;
                  text-align: center;
                }
                .return-label h3 {
                  margin: 0 0 16px 0;
                  color: #111827;
                  font-size: 18px;
                }
                .address-block {
                  background: white;
                  border: 1px solid #e5e7eb;
                  padding: 16px;
                  margin: 16px 0;
                  text-align: left;
                  line-height: 1.8;
                }
                .qr-code {
                  margin: 20px 0;
                }
                .instructions {
                  background: #fef3c7;
                  border-left: 4px solid #f59e0b;
                  padding: 16px;
                  margin: 24px 0;
                  border-radius: 4px;
                }
                .instructions ol {
                  margin: 8px 0;
                  padding-left: 20px;
                }
                .instructions li {
                  margin: 8px 0;
                  color: #78350f;
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
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Return Approved</h1>
                </div>
                <div class="content">
                  <h2>Hi ${customerName},</h2>
                  <p>Good news! Your return request for order <strong>#${orderNumber}</strong> has been approved.</p>
                  
                  <div class="info-box">
                    <strong>Return Authorization:</strong> ${returnAuthNumber}<br>
                    <strong>Return Reason:</strong> ${returnReason}
                  </div>

                  <div class="instructions">
                    <h3 style="margin-top: 0; color: #78350f;">📦 Return Shipping Instructions</h3>
                    <ol>
                      <li><strong>No Printer Needed:</strong> Show this QR code at any UPS, FedEx, or postal location</li>
                      <li>The carrier will scan the QR code to generate your shipping label</li>
                      <li>Pack the item securely in its original packaging</li>
                      <li>Hand over the package - shipping is prepaid</li>
                      <li>Keep your receipt for tracking</li>
                    </ol>
                    <p style="margin: 16px 0 0 0; font-size: 14px;">
                      <strong>Important:</strong> Your refund will be processed within 3-5 business days after we receive and inspect the returned item.
                    </p>
                  </div>

                  <div class="return-label">
                    <h3>📱 Return QR Code - Scan at Carrier</h3>
                    <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">Show this code at UPS, FedEx, or USPS - No printing required!</p>
                    <div class="qr-code">
                      <img src="${qrCodeDataUrl}" alt="Return QR Code" width="300" height="300" style="border: 3px solid #10b981; padding: 12px; background: white; border-radius: 8px;" />
                      <p style="font-size: 16px; font-weight: 600; color: #111827; margin: 12px 0;"><strong>RMA:</strong> ${returnAuthNumber}</p>
                      <p style="font-size: 14px; color: #6b7280; margin: 4px 0;">Order: ${orderNumber}</p>
                    </div>
                    <div class="address-block">
                      <strong style="font-size: 16px; display: block; margin-bottom: 8px;">Return To:</strong>
                      <div style="font-size: 14px; color: #374151;">
                        ${returnAddress.name}<br>
                        ${returnAddress.addressLine1}<br>
                        ${returnAddress.city}, ${returnAddress.state} ${returnAddress.postalCode}<br>
                        ${returnAddress.country}<br>
                        Phone: ${returnAddress.phone}
                      </div>
                    </div>
                  </div>

                  <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
                    If you have any questions about the return process, please don't hesitate to contact our customer support.
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
      });

      this.logger.log(`Return approval email sent to ${email} for order ${orderNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send return approval email to ${email}:`, error);
      throw new Error('Failed to send return approval email');
    }
  }

  async sendVendorWelcomeEmail(email: string, firstName: string, storeName: string) {
    const appName = this.configService.get('APP_NAME') || 'GaliCart';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const dashboardLink = `${appUrl}/vendor/dashboard`;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM') || this.configService.get('SMTP_USER'),
        to: email,
        subject: `Welcome to ${appName} - Vendor Registration Received`,
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
                  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
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
                .store-info {
                  background: #e0f2fe;
                  padding: 20px;
                  border-radius: 6px;
                  margin: 24px 0;
                  border-left: 4px solid #0284c7;
                }
                .store-info strong {
                  color: #0369a1;
                  font-size: 18px;
                }
                .status-badge {
                  display: inline-block;
                  padding: 8px 16px;
                  background: #fef3c7;
                  color: #92400e;
                  border-radius: 20px;
                  font-weight: 600;
                  font-size: 14px;
                  margin: 16px 0;
                }
                .button {
                  display: inline-block;
                  padding: 14px 32px;
                  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
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
                .next-steps {
                  background: #f8f9fa;
                  padding: 20px;
                  border-radius: 6px;
                  margin: 24px 0;
                }
                .next-steps h3 {
                  margin-top: 0;
                  color: #333;
                  font-size: 18px;
                }
                .next-steps ul {
                  margin: 12px 0;
                  padding-left: 20px;
                }
                .next-steps li {
                  margin: 8px 0;
                  color: #666;
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
                  color: #0284c7;
                  text-decoration: none;
                }
                .divider {
                  border: 0;
                  border-top: 1px solid #e9ecef;
                  margin: 24px 0;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="icon">🏪</div>
                  <h1>${appName}</h1>
                </div>
                <div class="content">
                  <h2>Welcome to ${appName}! 🎉</h2>
                  <p>Hi ${firstName},</p>
                  <p>Thank you for registering as a vendor on ${appName}! We're excited to have you join our marketplace community.</p>
                  
                  <div class="store-info">
                    <strong>Store Name:</strong> ${storeName}
                  </div>
                  
                  <p>Your vendor account has been created with the following status:</p>
                  <div style="text-align: center;">
                    <span class="status-badge">⏳ PENDING APPROVAL</span>
                  </div>
                  
                  <hr class="divider">
                  
                  <div class="next-steps">
                    <h3>📋 What Happens Next?</h3>
                    <ul>
                      <li><strong>Email Verification:</strong> Please verify your email address using the verification link sent in a separate email.</li>
                      <li><strong>Admin Review:</strong> Our team will review your vendor application within 24-48 hours.</li>
                      <li><strong>Account Activation:</strong> Once approved, you'll receive an email and can start listing your products.</li>
                      <li><strong>Dashboard Access:</strong> You can log in to your dashboard now to explore the interface.</li>
                    </ul>
                  </div>
                  
                  <div style="text-align: center;">
                    <a href="${dashboardLink}" class="button">Go to Vendor Dashboard</a>
                  </div>
                  
                  <hr class="divider">
                  
                  <p style="font-size: 14px; color: #666;">
                    <strong>Need Help Getting Started?</strong><br>
                    Check out our vendor documentation or contact our support team for assistance.
                  </p>
                  
                  <p style="font-size: 14px; color: #999; margin-top: 24px;">
                    <strong>Note:</strong> If you didn't register as a vendor on ${appName}, please contact our support team immediately.
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
Welcome to ${appName}!

Hi ${firstName},

Thank you for registering as a vendor on ${appName}! We're excited to have you join our marketplace community.

Store Name: ${storeName}
Status: PENDING APPROVAL

What Happens Next?

1. Email Verification: Please verify your email address using the verification link sent in a separate email.
2. Admin Review: Our team will review your vendor application within 24-48 hours.
3. Account Activation: Once approved, you'll receive an email and can start listing your products.
4. Dashboard Access: You can log in to your dashboard now to explore the interface.

Visit your vendor dashboard: ${dashboardLink}

Need help getting started? Check out our vendor documentation or contact our support team for assistance.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
        `,
      });

      this.logger.log(`Vendor welcome email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send vendor welcome email to ${email}:`, error);
      throw new Error('Failed to send vendor welcome email');
    }
  }
}
