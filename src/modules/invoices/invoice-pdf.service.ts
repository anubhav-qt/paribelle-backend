import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { ConfigService } from '@nestjs/config';

const PDFDocument = require('pdfkit');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private configService: ConfigService,
  ) {}

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    // Load invoice with order and order items
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'order.items', 'order.items.product', 'vendor', 'customer'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Use order items directly
    const items = invoice.order?.items || [];

    this.logger.log(`Generating PDF for invoice ${invoiceId} with ${items.length} items from order`);
    if (items.length === 0) {
      this.logger.warn(`No order items found for invoice ${invoiceId}`);
    }

    // Create PDF
    return await this.createPdfDocument(invoice, items);
  }

  /**
   * Create PDF document
   */
  private async createPdfDocument(invoice: Invoice, items: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add content
        this.addHeader(doc, invoice);
        this.addBillingInfo(doc, invoice);
        this.addInvoiceDetails(doc, invoice);
        this.addItemsTable(doc, items);
        this.addTotals(doc, invoice);
        this.addFooter(doc, invoice);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: any, invoice: Invoice): void {
    const appName = this.configService.get('APP_NAME') || 'Marketplace';
    const appAddress = this.configService.get('APP_ADDRESS') || '';
    const appPhone = this.configService.get('APP_PHONE') || '';
    const appEmail = this.configService.get('APP_EMAIL') || '';

    // Company logo/name
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(appName, 50, 50);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(appAddress, 50, 80)
      .text(appPhone, 50, 95)
      .text(appEmail, 50, 110);

    // Invoice title
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(this.getInvoiceTitle(invoice), 400, 50, { align: 'right' });

    doc.moveDown(0.5);
  }

  /**
   * Get invoice title based on type
   */
  private getInvoiceTitle(invoice: Invoice): string {
    switch (invoice.type) {
      case 'customer':
        return 'INVOICE';
      case 'vendor':
        return 'PAYOUT STATEMENT';
      case 'platform':
        return 'COMMISSION INVOICE';
      default:
        return 'INVOICE';
    }
  }

  /**
   * Add billing information
   */
  private addBillingInfo(doc: any, invoice: Invoice): void {
    const currentY = doc.y;

    // Bill To
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Bill To:', 50, currentY);

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(invoice.billingName || 'N/A', 50, currentY + 18)
      .text(invoice.billingEmail || '', 50, currentY + 30)
      .text(invoice.billingPhone || '', 50, currentY + 42);

    if (invoice.billingAddress) {
      doc.text(invoice.billingAddress, 50, currentY + 54);
      doc.text(
        `${invoice.billingCity}, ${invoice.billingState} ${invoice.billingPostalCode}`,
        50,
        currentY + 66
      );
    }

    if (invoice.gstNumber) {
      doc.text(`GST: ${invoice.gstNumber}`, 50, currentY + 78);
    }

    if (invoice.panNumber) {
      doc.text(`PAN: ${invoice.panNumber}`, 50, currentY + 90);
    }

    doc.moveDown(3);
  }

  /**
   * Add invoice details
   */
  private addInvoiceDetails(doc: any, invoice: Invoice): void {
    const currentY = 140;
    const labelX = 350;
    const valueX = 460;
    const lineHeight = 15;

    // Invoice Number - use smaller font if too long
    const invoiceNumFontSize = invoice.invoiceNumber.length > 20 ? 8 : 10;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Number:', labelX, currentY)
      .fontSize(invoiceNumFontSize)
      .font('Helvetica')
      .text(invoice.invoiceNumber, valueX, currentY, { width: 145, align: 'left' });

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Date:', labelX, currentY + lineHeight)
      .font('Helvetica')
      .text(this.formatDate(invoice.invoiceDate), valueX, currentY + lineHeight);

    doc
      .font('Helvetica-Bold')
      .text('Due Date:', labelX, currentY + lineHeight * 2)
      .font('Helvetica')
      .text(this.formatDate(invoice.dueDate), valueX, currentY + lineHeight * 2);

    doc
      .font('Helvetica-Bold')
      .text('Status:', labelX, currentY + lineHeight * 3)
      .font('Helvetica')
      .text(invoice.status.toUpperCase(), valueX, currentY + lineHeight * 3);

    if (invoice.order) {
      // Order Number - use smaller font if too long
      const orderNumFontSize = invoice.order.orderNumber.length > 20 ? 8 : 10;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Order Number:', labelX, currentY + lineHeight * 4)
        .fontSize(orderNumFontSize)
        .font('Helvetica')
        .text(invoice.order.orderNumber, valueX, currentY + lineHeight * 4, { width: 145, align: 'left' });
    }

    doc.moveDown(2);
  }

  /**
   * Add items table
   */
  private addItemsTable(doc: any, items: any[]): void {
    const tableTop = doc.y + 20;
    const itemCodeX = 40;
    const descriptionX = 110;
    const quantityX = 320;
    const priceX = 390;
    const amountX = 480;

    // Table header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Item', itemCodeX, tableTop)
      .text('Description', descriptionX, tableTop)
      .text('Qty', quantityX, tableTop)
      .text('Price', priceX, tableTop)
      .text('Amount', amountX, tableTop);

    // Draw line under header
    doc
      .moveTo(40, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    let currentY = tableTop + 25;

    // Check if there are no items
    if (!items || items.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text('No items found', itemCodeX, currentY);
      
      currentY += 30;
      doc.fillColor('#000000');
    } else {
      // Table rows - limit to first 15 items to fit on one page
      const displayItems = items.slice(0, 15);
      displayItems.forEach((item, index) => {
        doc
          .fontSize(8)
          .font('Helvetica')
          .text(item.productName || item.name, itemCodeX, currentY, { width: 65 })
          .text(item.variantDetails ? JSON.stringify(item.variantDetails) : (item.description || ''), descriptionX, currentY, { width: 200 })
          .text(item.quantity.toString(), quantityX, currentY)
          .text(this.formatCurrency(item.price || item.unitPrice), priceX, currentY)
          .text(this.formatCurrency((item.price || item.unitPrice) * item.quantity), amountX, currentY);

        const hsnCode = item.product?.hsnCode || item.hsnCode;
        if (hsnCode) {
          doc
            .fontSize(7)
            .fillColor('#666666')
            .text(`HSN: ${hsnCode}`, itemCodeX, currentY + 10);
        }

        currentY += hsnCode ? 24 : 18;
      });
      
      // Show count if items were truncated
      if (items.length > 15) {
        doc
          .fontSize(8)
          .fillColor('#666666')
          .text(`... and ${items.length - 15} more items`, itemCodeX, currentY);
        currentY += 18;
      }
    }

    // Draw line after items
    doc
      .moveTo(40, currentY)
      .lineTo(550, currentY)
      .stroke();

    doc.fillColor('#000000');
    doc.y = currentY + 10;
  }

  /**
   * Add totals section
   */
  private addTotals(doc: any, invoice: Invoice): void {
    const currentY = doc.y + 10;
    const labelX = 380;
    const valueX = 480;
    let lineY = 0;

    doc.fontSize(9).font('Helvetica');

    // Subtotal
    doc
      .text('Subtotal:', labelX, currentY)
      .text(this.formatCurrency(invoice.subtotal), valueX, currentY, { align: 'right' });
    lineY = currentY + 12;

    // Discount
    if (invoice.discount > 0) {
      doc
        .text('Discount:', labelX, lineY)
        .text(`-${this.formatCurrency(invoice.discount)}`, valueX, lineY, { align: 'right' });
      lineY += 12;
    }

    // Shipping
    if (invoice.shippingCost > 0) {
      doc
        .text('Shipping:', labelX, lineY)
        .text(this.formatCurrency(invoice.shippingCost), valueX, lineY, { align: 'right' });
      lineY += 12;
    }

    // Tax
    if (invoice.tax > 0) {
      doc
        .text('Tax:', labelX, lineY)
        .text(this.formatCurrency(invoice.tax), valueX, lineY, { align: 'right' });
      lineY += 12;
    }

    // Draw line before total
    doc
      .moveTo(380, lineY + 5)
      .lineTo(550, lineY + 5)
      .stroke();

    // Total
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Total:', labelX, lineY + 12)
      .text(this.formatCurrency(invoice.total), valueX, lineY + 12, { align: 'right' });

    // For vendor invoices, show commission and payout
    if (invoice.type === 'vendor' && invoice.commissionAmount) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Commission (${invoice.commissionRate}%):`, labelX, lineY + 30)
        .text(`-${this.formatCurrency(invoice.commissionAmount)}`, valueX, lineY + 30, { align: 'right' });

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#22c55e')
        .text('Payout Amount:', labelX, lineY + 45)
        .text(this.formatCurrency(invoice.payoutAmount), valueX, lineY + 45, { align: 'right' });

      doc.fillColor('#000000');
    }

    doc.moveDown(2);
  }

  /**
   * Add footer
   */
  private addFooter(doc: any, invoice: Invoice): void {
    const footerY = doc.y + 15;

    // Notes
    if (invoice.notes) {
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Notes:', 50, footerY);

      doc
        .fontSize(7)
        .font('Helvetica')
        .text(invoice.notes, 50, footerY + 12, { width: 500 });
    }

    // Terms
    if (invoice.terms) {
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Terms & Conditions:', 50, footerY + 35);

      doc
        .fontSize(7)
        .font('Helvetica')
        .text(invoice.terms, 50, footerY + 47, { width: 500 });
    }
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}
