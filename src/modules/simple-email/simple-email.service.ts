import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sends mail through Brevo's HTTP API rather than SMTP.
 *
 * Render's free tier blocks outbound connections to every SMTP port (25,
 * 465, 587) as a platform-wide anti-spam measure — this is not something
 * any SMTP host or credential fixes, since the block happens before the TCP
 * handshake completes. It surfaces as a connection timeout at almost
 * exactly the transport's own timeout value, which is what an SMTP-based
 * version of this service hit in production. Brevo's API runs over plain
 * HTTPS (port 443), which is not blocked.
 */
@Injectable()
export class SimpleEmailService {
  private readonly logger = new Logger(SimpleEmailService.name);
  private static readonly BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {}

  /**
   * The one place every method below actually sends mail. Takes the same
   * shape nodemailer's `sendMail` did (`to`/`subject`/`html`/`text`/
   * `attachments` with `Buffer` content) so none of the call sites below
   * needed to change — only how the message leaves the server did.
   */
  private async sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is not configured');
    }

    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@paribelle.in';
    const appName = this.configService.get<string>('APP_NAME') || 'PariBelle';
    // "Name <email@domain>" or a bare address — accept either, since that's
    // what SMTP_FROM already held before this switch.
    const fromMatch = fromAddress.match(/^(.*)<(.+)>$/);
    const sender = fromMatch
      ? { name: fromMatch[1].trim().replace(/^"|"$/g, ''), email: fromMatch[2].trim() }
      : { name: appName, email: fromAddress.trim() };

    const body: Record<string, unknown> = {
      sender,
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    };
    if (options.text) body.textContent = options.text;
    if (options.attachments?.length) {
      body.attachment = options.attachments.map((a) => ({
        name: a.filename,
        content: a.content.toString('base64'),
      }));
    }

    const response = await fetch(SimpleEmailService.BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Brevo API error (${response.status}): ${errorBody || response.statusText}`);
    }

    return response.json();
  }

  async sendInvoiceEmail(
    email: string,
    recipientName: string,
    subject: string,
    message: string,
    invoice: any,
  ) {
    const appName = this.configService.get('APP_NAME') || 'PariBelle';
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

      const invoiceTypeLabel = this.getInvoiceTypeLabel(invoice.invoiceNumber);

      await this.sendEmail({
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
                  </div>
                  
                  <hr class="divider">
                  
                  <p style="font-size: 14px; color: #666;">
                    The invoice is attached to this email as a PDF document. If you have any questions or concerns, please don't hesitate to contact us.
                  </p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                  <p>Questions? Just reply to this email.</p>
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

  private getInvoiceTypeLabel(invoiceNumber: string): string {
    return invoiceNumber?.startsWith('CN-') ? 'Credit Note' : 'Invoice';
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
    const appName = this.configService.get('APP_NAME') || 'PariBelle';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      await this.sendEmail({
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
}
