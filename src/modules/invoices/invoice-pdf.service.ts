import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { ConfigService } from '@nestjs/config';

const PDFDocument = require('pdfkit');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    private configService: ConfigService,
  ) {}

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    // Load invoice with all relations
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'vendor', 'customer'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Load invoice items
    const items = await this.invoiceItemRepository.find({
      where: { invoiceId },
      relations: ['product'],
    });

    this.logger.log(`Generating PDF for invoice ${invoiceId} with ${items.length} items`);
    if (items.length === 0) {
      this.logger.warn(`No items found for invoice ${invoiceId}`);
    }

    // Create PDF
    return await this.createPdfDocument(invoice, items);
  }

  /**
   * Create PDF document
   */
  private async createPdfDocument(invoice: Invoice, items: InvoiceItem[]): Promise<Buffer> {
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
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(this.getInvoiceTitle(invoice), 400, 50, { align: 'right' });

    doc.moveDown(3);
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
      .fontSize(10)
      .font('Helvetica')
      .text(invoice.billingName || 'N/A', 50, currentY + 20)
      .text(invoice.billingEmail || '', 50, currentY + 35)
      .text(invoice.billingPhone || '', 50, currentY + 50);

    if (invoice.billingAddress) {
      doc.text(invoice.billingAddress, 50, currentY + 65);
      doc.text(
        `${invoice.billingCity}, ${invoice.billingState} ${invoice.billingPostalCode}`,
        50,
        currentY + 80
      );
    }

    if (invoice.gstNumber) {
      doc.text(`GST: ${invoice.gstNumber}`, 50, currentY + 95);
    }

    if (invoice.panNumber) {
      doc.text(`PAN: ${invoice.panNumber}`, 50, currentY + 110);
    }

    doc.moveDown(7);
  }

  /**
   * Add invoice details
   */
  private addInvoiceDetails(doc: any, invoice: Invoice): void {
    const currentY = 140;

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Number:', 350, currentY)
      .font('Helvetica')
      .text(invoice.invoiceNumber, 460, currentY, { width: 90, lineBreak: false });

    doc
      .font('Helvetica-Bold')
      .text('Invoice Date:', 350, currentY + 15)
      .font('Helvetica')
      .text(this.formatDate(invoice.invoiceDate), 460, currentY + 15);

    doc
      .font('Helvetica-Bold')
      .text('Due Date:', 350, currentY + 30)
      .font('Helvetica')
      .text(this.formatDate(invoice.dueDate), 460, currentY + 30);

    doc
      .font('Helvetica-Bold')
      .text('Status:', 350, currentY + 45)
      .font('Helvetica')
      .text(invoice.status.toUpperCase(), 460, currentY + 45);

    if (invoice.order) {
      doc
        .font('Helvetica-Bold')
        .text('Order Number:', 350, currentY + 60)
        .font('Helvetica')
        .text(invoice.order.orderNumber, 460, currentY + 60);
    }

    doc.moveDown(5);
  }

  /**
   * Add items table
   */
  private addItemsTable(doc: any, items: InvoiceItem[]): void {
    const tableTop = doc.y + 20;
    const itemCodeX = 50;
    const descriptionX = 120;
    const quantityX = 300;
    const priceX = 360;
    const amountX = 460;

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
      .moveTo(50, tableTop + 15)
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
      // Table rows
      items.forEach((item, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        doc
          .fontSize(9)
          .font('Helvetica')
          .text(item.name, itemCodeX, currentY, { width: 60 })
          .text(item.description || '', descriptionX, currentY, { width: 170 })
          .text(item.quantity.toString(), quantityX, currentY)
          .text(this.formatCurrency(item.unitPrice), priceX, currentY)
          .text(this.formatCurrency(item.total), amountX, currentY);

        if (item.hsnCode) {
          doc
            .fontSize(8)
            .fillColor('#666666')
            .text(`HSN: ${item.hsnCode}`, itemCodeX, currentY + 12);
        }

        currentY += 35;
      });
    }

    // Draw line after items
    doc
      .moveTo(50, currentY)
      .lineTo(550, currentY)
      .stroke();

    doc.fillColor('#000000');
    doc.y = currentY + 10;
  }

  /**
   * Add totals section
   */
  private addTotals(doc: any, invoice: Invoice): void {
    const currentY = doc.y + 20;
    const labelX = 380;
    const valueX = 480;

    doc.fontSize(10).font('Helvetica');

    // Subtotal
    doc
      .text('Subtotal:', labelX, currentY)
      .text(this.formatCurrency(invoice.subtotal), valueX, currentY, { align: 'right' });

    // Discount
    if (invoice.discount > 0) {
      doc
        .text('Discount:', labelX, currentY + 15)
        .text(`-${this.formatCurrency(invoice.discount)}`, valueX, currentY + 15, { align: 'right' });
    }

    // Shipping
    if (invoice.shippingCost > 0) {
      doc
        .text('Shipping:', labelX, currentY + 30)
        .text(this.formatCurrency(invoice.shippingCost), valueX, currentY + 30, { align: 'right' });
    }

    // Tax
    if (invoice.tax > 0) {
      doc
        .text('Tax:', labelX, currentY + 45)
        .text(this.formatCurrency(invoice.tax), valueX, currentY + 45, { align: 'right' });
    }

    // Draw line before total
    doc
      .moveTo(380, currentY + 60)
      .lineTo(550, currentY + 60)
      .stroke();

    // Total
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Total:', labelX, currentY + 70)
      .text(this.formatCurrency(invoice.total), valueX, currentY + 70, { align: 'right' });

    // For vendor invoices, show commission and payout
    if (invoice.type === 'vendor' && invoice.commissionAmount) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Commission (${invoice.commissionRate}%):`, labelX, currentY + 95)
        .text(`-${this.formatCurrency(invoice.commissionAmount)}`, valueX, currentY + 95, { align: 'right' });

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#22c55e')
        .text('Payout Amount:', labelX, currentY + 115)
        .text(this.formatCurrency(invoice.payoutAmount), valueX, currentY + 115, { align: 'right' });

      doc.fillColor('#000000');
    }

    doc.moveDown(8);
  }

  /**
   * Add footer
   */
  private addFooter(doc: any, invoice: Invoice): void {
    const footerY = doc.y + 30;

    // Notes
    if (invoice.notes) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Notes:', 50, footerY);

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(invoice.notes, 50, footerY + 15, { width: 500 });
    }

    // Terms
    if (invoice.terms) {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Terms & Conditions:', 50, footerY + 50);

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(invoice.terms, 50, footerY + 65, { width: 500 });
    }

    // Add page numbers at the bottom
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .text(
          `Page ${i + 1} of ${pages.count}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );
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
