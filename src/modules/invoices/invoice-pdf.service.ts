import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../admin/settings.service';

const PDFDocument = require('pdfkit');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private configService: ConfigService,
    private settingsService: SettingsService,
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
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add content in Amazon/Flipkart style
        await this.addModernHeader(doc, invoice);
        await this.addAddressSection(doc, invoice);
        this.addModernItemsTable(doc, items, invoice);
        this.addModernTotals(doc, invoice);
        this.addModernFooter(doc, invoice);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add modern header (Amazon/Flipkart style)
   */
  private async addModernHeader(doc: any, invoice: Invoice): Promise<void> {
    const appName = await this.settingsService.getSetting('marketplace_name') || 'GaliCart';
    
    // Top border - different color for vendor invoices
    const headerColor = invoice.type === 'vendor' ? '#e0f2fe' : '#f8f9fa';
    const borderColor = invoice.type === 'vendor' ? '#0284c7' : '#dee2e6';
    doc.rect(40, 40, 515, 80).fillAndStroke(headerColor, borderColor);
    
    // Company name - left side
    doc
      .fillColor('#000000')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(appName, 55, 55);

    // Invoice title - right side (different for vendor invoices)
    const invoiceTitle = invoice.type === 'vendor' ? 'Vendor Payout Statement' 
                       : invoice.type === 'platform' ? 'Commission Invoice'
                       : 'Tax Invoice';
    
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(invoiceTitle, 280, 52, { width: 265, align: 'right' });

    // Invoice number below
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Invoice No: ${invoice.invoiceNumber}`, 280, 75, { width: 265, align: 'right' });

    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(`Date: ${this.formatShortDate(invoice.invoiceDate)}`, 280, 88, { width: 265, align: 'right' });

    if (invoice.order) {
      doc.text(`Order No: ${invoice.order.orderNumber}`, 280, 101, { width: 265, align: 'right' });
    }

    doc.fillColor('#000000');
    doc.y = 135;
  }

  /**
   * Add address section (sold by, billing and shipping in three columns)
   */
  private async addAddressSection(doc: any, invoice: Invoice): Promise<void> {
    const startY = doc.y;

    // For vendor invoices: two columns (Platform | Vendor)
    // For customer invoices: three sections (Sold By | Billing | Shipping)
    if (invoice.type === 'vendor') {
      await this.addVendorAddressSection(doc, invoice, startY);
    } else {
      this.addCustomerAddressSection(doc, invoice, startY);
    }
  }

  /**
   * Add vendor invoice address section (two columns)
   */
  private async addVendorAddressSection(doc: any, invoice: Invoice, startY: number): Promise<void> {
    const leftX = 40;
    const rightX = 305;

    const leftLabel = 'Platform Details:';
    const rightLabel = 'Vendor/Payee Details:';

    // Left section - Platform Details
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(leftLabel, leftX, startY);

    const appName = await this.settingsService.getSetting('marketplace_name') || 'GaliCart';
    const appAddress = this.configService.get('APP_ADDRESS') || '';
    const appPhone = this.configService.get('APP_PHONE') || '';
    const appEmail = this.configService.get('APP_EMAIL') || '';
    const appGst = this.configService.get('APP_GST') || '';

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(appName, leftX, startY + 15, { width: 240 });

    if (appAddress) {
      doc.text(appAddress, leftX, startY + 28, { width: 240 });
    }
    if (appPhone) {
      doc.text(`Phone: ${appPhone}`, leftX, startY + 50);
    }
    if (appEmail) {
      doc.text(`Email: ${appEmail}`, leftX, startY + 63);
    }
    if (appGst) {
      doc
        .font('Helvetica-Bold')
        .text(`GSTIN: ${appGst}`, leftX, startY + 76);
    }

    // Right section - Vendor Details
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(rightLabel, rightX, startY);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(invoice.billingName || 'N/A', rightX, startY + 15, { width: 240 });

    if (invoice.billingAddress) {
      doc.text(invoice.billingAddress, rightX, startY + 28, { width: 240 });
      const cityState = `${invoice.billingCity || ''}, ${invoice.billingState || ''} ${invoice.billingPostalCode || ''}`.trim();
      if (cityState.length > 2) {
        doc.text(cityState, rightX, startY + 50, { width: 240 });
      }
    }

    if (invoice.billingPhone) {
      doc.text(`Phone: ${invoice.billingPhone}`, rightX, startY + 63);
    }

    if (invoice.billingEmail) {
      doc.text(`Email: ${invoice.billingEmail}`, rightX, startY + 76);
    }

    if (invoice.gstNumber) {
      doc
        .font('Helvetica-Bold')
        .text(`GSTIN: ${invoice.gstNumber}`, rightX, startY + 89);
    }

    if (invoice.panNumber) {
      doc.text(`PAN: ${invoice.panNumber}`, rightX, startY + 102);
    }

    doc.fillColor('#000000');
    doc.y = startY + 120;

    // Horizontal line separator
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke('#dee2e6');

    doc.y += 15;
  }

  /**
   * Add customer invoice address section (three sections: Sold By, Billing, Shipping)
   */
  private addCustomerAddressSection(doc: any, invoice: Invoice, startY: number): void {
    const col1X = 40;
    const col2X = 210;
    const col3X = 380;
    const colWidth = 160;

    // Column 1 - Sold By (Vendor)
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Sold By:', col1X, startY);

    const vendorName = invoice.order?.vendor?.businessName || invoice.order?.vendor?.storeName || 'Vendor';
    const vendorAddress = invoice.order?.vendor?.address || '';
    const vendorCity = invoice.order?.vendor?.city || '';
    const vendorState = invoice.order?.vendor?.state || '';
    const vendorGst = invoice.order?.vendor?.gstNumber || '';

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(vendorName, col1X, startY + 15, { width: colWidth, ellipsis: true });

    if (vendorAddress) {
      doc.text(vendorAddress, col1X, startY + 28, { width: colWidth });
    }
    if (vendorCity && vendorState) {
      doc.text(`${vendorCity}, ${vendorState}`, col1X, startY + 50, { width: colWidth });
    }
    if (vendorGst) {
      doc
        .font('Helvetica-Bold')
        .text(`GSTIN: ${vendorGst}`, col1X, startY + 63, { width: colWidth });
    }

    // Column 2 - Billing Address
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Billing Address:', col2X, startY);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(invoice.billingName || 'N/A', col2X, startY + 15, { width: colWidth, ellipsis: true });

    if (invoice.billingAddress) {
      doc.text(invoice.billingAddress, col2X, startY + 28, { width: colWidth });
      const billCityState = `${invoice.billingCity || ''}, ${invoice.billingState || ''} ${invoice.billingPostalCode || ''}`.trim();
      if (billCityState.length > 2) {
        doc.text(billCityState, col2X, startY + 50, { width: colWidth });
      }
    }
    if (invoice.billingPhone) {
      doc.text(`Ph: ${invoice.billingPhone}`, col2X, startY + 63, { width: colWidth });
    }

    // Column 3 - Shipping Address
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Shipping Address:', col3X, startY);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(invoice.shippingName || invoice.billingName || 'N/A', col3X, startY + 15, { width: colWidth, ellipsis: true });

    const shipAddr = invoice.shippingAddress || invoice.billingAddress;
    if (shipAddr) {
      doc.text(shipAddr, col3X, startY + 28, { width: colWidth });
      const shipCityState = `${invoice.shippingCity || invoice.billingCity || ''}, ${invoice.shippingState || invoice.billingState || ''} ${invoice.shippingPostalCode || invoice.billingPostalCode || ''}`.trim();
      if (shipCityState.length > 2) {
        doc.text(shipCityState, col3X, startY + 50, { width: colWidth });
      }
    }
    const shipPhone = invoice.shippingPhone || invoice.billingPhone;
    if (shipPhone) {
      doc.text(`Ph: ${shipPhone}`, col3X, startY + 63, { width: colWidth });
    }

    doc.fillColor('#000000');
    doc.y = startY + 90;

    // Horizontal line separator
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke('#dee2e6');

    doc.y += 15;
  }

  /**
   * Add modern items table
   */
  private addModernItemsTable(doc: any, items: any[], invoice: Invoice): void {
    const tableTop = doc.y;
    const itemX = 45;
    const hsnX = 260;
    const qtyX = 320;
    const priceX = 370;
    const taxX = 430;
    const totalX = 490;

    // Table header with background
    doc.rect(40, tableTop, 515, 25).fillAndStroke('#e9ecef', '#dee2e6');
    
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Product', itemX, tableTop + 8)
      .text('HSN', hsnX, tableTop + 8)
      .text('Qty', qtyX, tableTop + 8)
      .text('Price', priceX, tableTop + 8)
      .text('Tax', taxX, tableTop + 8)
      .text('Total', totalX, tableTop + 8);

    let currentY = tableTop + 35;

    if (!items || items.length === 0) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#666666')
        .text('No items found', itemX, currentY);
      
      currentY += 30;
      doc.fillColor('#000000');
    } else {
      items.forEach((item, index) => {
        // Alternate row colors
        if (index % 2 === 1) {
          doc.rect(40, currentY - 5, 515, 30).fillAndStroke('#f8f9fa', '#f8f9fa');
        }

        const productName = item.productName || item.name;
        const hsnCode = item.product?.hsnCode || item.hsnCode || '-';
        const quantity = item.quantity;
        const unitPrice = item.price || item.unitPrice;
        
        // Get product pricing details
        const product = item.product;
        const priceType = product?.priceType || 'mrp_with_gst';
        const gstRate = Number(product?.gstRate) || 18;
        
        // Calculate base price and tax based on price type
        let baseUnitPrice = unitPrice;
        let taxPerUnit = 0;
        
        if (priceType === 'mrp_with_gst') {
          // Extract base price and tax from inclusive price
          baseUnitPrice = unitPrice / (1 + gstRate / 100);
          taxPerUnit = unitPrice - baseUnitPrice;
        } else {
          // Price is exclusive, calculate tax
          taxPerUnit = unitPrice * (gstRate / 100);
        }
        
        const baseItemTotal = baseUnitPrice * quantity;
        const taxAmount = taxPerUnit * quantity;
        const itemTotal = baseItemTotal + taxAmount;

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#000000')
          .text(productName, itemX, currentY, { width: 200, ellipsis: true })
          .text(hsnCode, hsnX, currentY)
          .text(quantity.toString(), qtyX, currentY)
          .text(this.formatCurrency(baseUnitPrice), priceX, currentY)
          .text(taxAmount > 0 ? this.formatCurrency(taxAmount) : '-', taxX, currentY)
          .text(this.formatCurrency(itemTotal), totalX, currentY);

        // Variant details if any
        if (item.variantDetails && Object.keys(item.variantDetails).length > 0) {
          doc
            .fontSize(7)
            .fillColor('#666666')
            .text(this.formatVariantDetails(item.variantDetails), itemX, currentY + 10, { width: 200 });
        }

        currentY += 30;

        // Add page break if needed
        if (currentY > 700 && index < items.length - 1) {
          doc.addPage();
          currentY = 50;
        }
      });
    }

    // Bottom border
    doc
      .moveTo(40, currentY)
      .lineTo(555, currentY)
      .stroke('#dee2e6');

    doc.fillColor('#000000');
    doc.y = currentY + 10;
  }

  /**
   * Add modern totals section
   */
  private addModernTotals(doc: any, invoice: Invoice): void {
    const startY = doc.y + 10;
    const labelX = 380;
    const valueX = 490;

    // Amount in words box (left side)
    doc.rect(40, startY, 320, 80).stroke('#dee2e6');
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Amount in Words:', 50, startY + 10);
    
    // For vendor invoices, show payout amount in words, otherwise show total
    const amountInWords = invoice.type === 'vendor' && invoice.payoutAmount 
      ? this.convertToWords(invoice.payoutAmount)
      : this.convertToWords(invoice.total);
    
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(amountInWords, 50, startY + 25, { width: 300 });

    // Totals section (right side)
    let lineY = startY;

    doc.fontSize(9).font('Helvetica');

    // Subtotal
    doc
      .fillColor('#666666')
      .text('Sub Total:', labelX, lineY)
      .fillColor('#000000')
      .text(this.formatCurrency(invoice.subtotal), valueX, lineY, { align: 'right' });
    lineY += 15;

    // Discount
    if (invoice.discount && invoice.discount !== 0) {
      doc
        .fillColor('#666666')
        .text('Discount:', labelX, lineY)
        .fillColor('#22c55e')
        .text(`-${this.formatCurrency(Math.abs(invoice.discount))}`, valueX, lineY, { align: 'right' });
      lineY += 15;
    }
    
    // Tax (show separately for normal invoices, combine with subtotal for credit notes)
    if (invoice.status !== 'cancelled' && invoice.tax && invoice.tax > 0) {
      // Determine if transaction is intra-state or inter-state
      const vendorState = invoice.order?.vendor?.state || invoice.order?.vendor?.gstState;
      const customerState = invoice.billingState;
      const isIntraState = vendorState && customerState && 
                           vendorState.toLowerCase().trim() === customerState.toLowerCase().trim();
      
      if (isIntraState) {
        // Intra-state: Show CGST + SGST
        const cgst = invoice.tax / 2;
        const sgst = invoice.tax / 2;
        
        doc
          .fillColor('#666666')
          .text('CGST (9%):', labelX, lineY)
          .fillColor('#000000')
          .text(this.formatCurrency(cgst), valueX, lineY, { align: 'right' });
        lineY += 15;

        doc
          .fillColor('#666666')
          .text('SGST (9%):', labelX, lineY)
          .fillColor('#000000')
          .text(this.formatCurrency(sgst), valueX, lineY, { align: 'right' });
        lineY += 15;
      } else {
        // Inter-state: Show IGST
        doc
          .fillColor('#666666')
          .text('IGST (18%):', labelX, lineY)
          .fillColor('#000000')
          .text(this.formatCurrency(invoice.tax), valueX, lineY, { align: 'right' });
        lineY += 15;
      }
    } else if (invoice.status === 'cancelled' && invoice.tax && invoice.tax !== 0) {
      // For credit notes, show tax as part of refundable amount
      doc
        .fillColor('#666666')
        .text('Tax (Refundable):', labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(invoice.tax), valueX, lineY, { align: 'right' });
      lineY += 15;
    }

    // Shipping
    if (invoice.shippingCost && invoice.shippingCost !== 0) {
      const shippingLabel = invoice.status === 'cancelled' ? 'Shipping (Non-refundable):' : 'Shipping:';
      doc
        .fillColor('#666666')
        .text(shippingLabel, labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(Math.abs(invoice.shippingCost)), valueX, lineY, { align: 'right' });
      lineY += 15;
    }

    // Line above Order Total
    doc
      .moveTo(370, lineY + 5)
      .lineTo(555, lineY + 5)
      .stroke('#dee2e6');

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Order Total:', labelX, lineY + 12)
      .text(this.formatCurrency(invoice.total), 450, lineY + 12, { width: 100, align: 'right' });

    lineY += 35;

    // For vendor invoices, show commission deduction and final payout
    if (invoice.type === 'vendor' && invoice.commissionAmount) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Platform Commission (${invoice.commissionRate}%):`, labelX, lineY)
        .fillColor('#ef4444')
        .text(`-${this.formatCurrency(invoice.commissionAmount)}`, valueX, lineY, { align: 'right' });
      lineY += 20;

      // Line above Vendor Payout
      doc
        .moveTo(370, lineY)
        .lineTo(555, lineY)
        .stroke('#10b981');

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#065f46')
        .text('Vendor Payout:', labelX, lineY + 8)
        .text(this.formatCurrency(invoice.payoutAmount), valueX, lineY + 8, { align: 'right' });

      lineY += 35;
    }

    doc.fillColor('#000000');
    doc.y = lineY + 10;
  }

  /**
   * Add modern footer
   */
  private addModernFooter(doc: any, invoice: Invoice): void {
    const footerY = doc.y + 20;

    // Payment/Payout status banner
    if (invoice.status === 'paid') {
      const statusText = invoice.type === 'vendor' ? 'PAYOUT PROCESSED' : 'PAID';
      const dateText = invoice.paidAt 
        ? `${invoice.type === 'vendor' ? 'Payout processed' : 'Payment received'} on ${this.formatShortDate(invoice.paidAt)}`
        : '';

      doc.rect(40, footerY, 515, 30).fillAndStroke('#d1fae5', '#10b981');
      
      // Draw green circle with checkmark
      doc
        .circle(60, footerY + 15, 8)
        .fillAndStroke('#10b981', '#065f46');
      
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#065f46')
        .text(statusText, 75, footerY + 10);
      
      if (dateText) {
        doc
          .fontSize(8)
          .font('Helvetica')
          .text(dateText, 200, footerY + 11);
      }
    } else if (invoice.status === 'pending' && invoice.type === 'vendor') {
      doc.rect(40, footerY, 515, 30).fillAndStroke('#fef3c7', '#f59e0b');
      
      // Draw orange clock icon
      doc
        .circle(60, footerY + 15, 8)
        .fillAndStroke('#f59e0b', '#92400e');
      
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#92400e')
        .text('PAYOUT PENDING', 75, footerY + 10);
      
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Expected payout date: ${this.formatShortDate(invoice.dueDate)}`, 200, footerY + 11);
    }

    // Terms and conditions
    const termsY = footerY + 50;
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Terms & Conditions:', 40, termsY);

    const terms = invoice.terms || 'This is a computer-generated invoice and does not require a physical signature.';
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor('#666666')
      .text(terms, 40, termsY + 12, { width: 515, lineGap: 2 });

    // Footer bar
    const footerBarColor = invoice.type === 'vendor' ? '#0284c7' : '#1a1a1a';
    doc.rect(40, 770, 515, 30).fillAndStroke(footerBarColor, footerBarColor);
    
    const footerText = invoice.type === 'vendor' 
      ? 'This is a vendor payout statement. For queries, contact support.'
      : 'Thank you for your business!';
    
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor('#ffffff')
      .text(footerText, 40, 782, { width: 515, align: 'center' });

    doc.fillColor('#000000');
  }

  /**
   * Format variant details
   */
  private formatVariantDetails(variantDetails: any): string {
    if (!variantDetails || typeof variantDetails !== 'object') {
      return '';
    }
    return Object.entries(variantDetails)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }

  /**
   * Convert amount to words
   */
  private convertToWords(amount: number): string {
    // Handle invalid inputs
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'Zero Rupees Only';
    }

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    // Use absolute value for negative amounts (credit notes)
    const absoluteAmount = Math.abs(amount);
    
    if (absoluteAmount === 0) return 'Zero Rupees Only';

    const numToWords = (n: number): string => {
      if (n === 0) return '';
      else if (n < 10) return ones[n];
      else if (n < 20) return teens[n - 10];
      else if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      else if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + numToWords(n % 100) : '');
      else if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + numToWords(n % 1000) : '');
      else if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + numToWords(n % 100000) : '');
      else return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + numToWords(n % 10000000) : '');
    };

    const rupees = Math.floor(absoluteAmount);
    const paise = Math.round((absoluteAmount - rupees) * 100);

    let words = numToWords(rupees) + ' Rupees';
    if (paise > 0) {
      words += ' and ' + numToWords(paise) + ' Paise';
    }
    words += ' Only';

    return words;
  }

  /**
   * Format date (short)
   */
  private formatShortDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
    // Handle invalid inputs
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0.00';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}
