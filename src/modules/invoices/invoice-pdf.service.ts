import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from './invoice.entity';
import { SettingsService } from '../admin/settings.service';
import { StoreService } from '../store/store.service';

const PDFDocument = require('pdfkit');

@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private settingsService: SettingsService,
    private storeService: StoreService,
  ) {}

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePdf(invoiceId: string): Promise<Buffer> {
    // Load invoice with order and order items, AND invoice items
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['order', 'order.items', 'order.items.product', 'customer', 'items'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Conditionally select items based on invoice type
    let items: any[];
    if (invoice.invoiceNumber?.startsWith('CN-') && invoice.items && invoice.items.length > 0) {
      // For credit notes, use invoice_items (only returned items)
      items = invoice.items;
      this.logger.log(`Generating PDF for credit note ${invoiceId} with ${items.length} returned items from invoice_items`);
    } else {
      // For regular invoices, use order.items (all items)
      items = invoice.order?.items || [];
      this.logger.log(`Generating PDF for invoice ${invoiceId} with ${items.length} items from order`);
    }

    if (items.length === 0) {
      this.logger.warn(`No items found for invoice ${invoiceId}`);
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
        await this.addAddressSection(doc, invoice, await this.sellerFor(invoice));
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
    const appName = await this.settingsService.getSetting('marketplace_name') || 'PariBelle';
    
    doc.rect(40, 40, 515, 80).fillAndStroke('#f8f9fa', '#dee2e6');
    
    // Company name - left side
    doc
      .fillColor('#000000')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(appName, 55, 55);

    const invoiceTitle = this.isCreditNote(invoice) ? 'Credit Note' : 'Tax Invoice';
    
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
   * Who sold it: each detail as the order froze it when placed, or the
   * store's current one where the order has none (orders placed before the
   * business details were filled in).
   */
  private async sellerFor(invoice: Invoice): Promise<{ name: string; address: string; cityState: string; gstin: string }> {
    const order: any = invoice.order ?? {};
    const store = await this.storeService.get().catch(() => null);
    const name = order.vendorBusinessName || order.vendorStoreName || store?.businessName || store?.storeName || 'PariBelle';
    const city = order.vendorCity || store?.city || '';
    const state = order.vendorState || store?.state || '';
    const postalCode = order.vendorPostalCode || store?.postalCode || '';
    return {
      name,
      address: order.vendorAddress || store?.address || '',
      cityState: [[city, state].filter(Boolean).join(', '), postalCode].filter(Boolean).join(' '),
      gstin: order.vendorGstNumber || store?.gstNumber || '',
    };
  }

  /**
   * Three columns: Sold By, Billing, Shipping.
   */
  private async addAddressSection(
    doc: any,
    invoice: Invoice,
    seller: { name: string; address: string; cityState: string; gstin: string },
  ): Promise<void> {
    const startY = doc.y;
    const col1X = 40;
    const col2X = 210;
    const col3X = 380;
    const colWidth = 160;

    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text('Sold By:', col1X, startY);

    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#333333')
      .text(seller.name, col1X, startY + 15, { width: colWidth, ellipsis: true });

    if (seller.address) {
      doc.text(seller.address, col1X, startY + 28, { width: colWidth });
    }
    if (seller.cityState) {
      doc.text(seller.cityState, col1X, startY + 50, { width: colWidth });
    }
    if (seller.gstin) {
      doc
        .font('Helvetica-Bold')
        .text(`GSTIN: ${seller.gstin}`, col1X, startY + 63, { width: colWidth });
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
      .text('Tax/Unit', taxX, tableTop + 8)
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
          .text(taxPerUnit > 0 ? this.formatCurrency(taxPerUnit) : '-', taxX, currentY)
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
    
    const amountInWords = this.convertToWords(invoice.total);
    
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(amountInWords, 50, startY + 25, { width: 300 });

    // Totals section (right side)
    let lineY = startY;
    const isCreditNote = this.isCreditNote(invoice);

    doc.fontSize(9).font('Helvetica');

    // Subtotal (use absolute value for credit notes)
    doc
      .fillColor('#666666')
      .text('Sub Total:', labelX, lineY)
      .fillColor('#000000')
      .text(this.formatCurrency(isCreditNote ? Math.abs(invoice.subtotal) : invoice.subtotal), valueX, lineY, { align: 'right' });
    lineY += 15;

    // Discount (only show if there's an actual discount)
    if (invoice.discount && Math.abs(invoice.discount) > 0) {
      doc
        .fillColor('#666666')
        .text('Discount:', labelX, lineY)
        .fillColor('#22c55e')
        .text(`-${this.formatCurrency(Math.abs(invoice.discount))}`, valueX, lineY, { align: 'right' });
      lineY += 15;
    }
    
    // Tax (show separately for normal invoices, combine with subtotal for credit notes)
    if (!isCreditNote && invoice.tax && invoice.tax > 0) {
      // Prices on the store are GST-inclusive: invoice.tax is the tax already
      // baked into the item prices, split back out for the invoice. It is not
      // an extra charge, and we do not itemise it as CGST/SGST vs IGST — a
      // single "GST/IGST" line covers both intra- and inter-state orders. The
      // percentage is derived from the tax actually charged, not hardcoded,
      // because the store sells at more than one rate (e.g. 3% on jewellery,
      // 18% on apparel).
      const totalGstPercent = Number(invoice.subtotal) > 0
        ? (Number(invoice.tax) / Number(invoice.subtotal)) * 100
        : 0;

      doc
        .fillColor('#666666')
        .text(`GST/IGST (${totalGstPercent.toFixed(2)}%):`, labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(invoice.tax), valueX, lineY, { align: 'right' });
      lineY += 15;
    } else if (isCreditNote && invoice.tax && invoice.tax !== 0) {
      // For credit notes, show tax as refundable amount (negative becomes positive for display)
      doc
        .fillColor('#666666')
        .text('Tax (Refundable):', labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(Math.abs(invoice.tax)), valueX, lineY, { align: 'right' });
      lineY += 15;
    }

    // Shipping (only show if there's an actual shipping cost)
    if (invoice.shippingCost && Math.abs(invoice.shippingCost) > 0) {
      const shippingLabel = isCreditNote ? 'Shipping (Non-refundable):' : 'Shipping:';
      doc
        .fillColor('#666666')
        .text(shippingLabel, labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(Math.abs(invoice.shippingCost)), valueX, lineY, { align: 'right' });
      lineY += 15;
    }

    // COD handling fee (only on Cash on Delivery orders; already part of the total)
    const codCharge = Number((invoice.order as any)?.codCharge) || 0;
    if (!isCreditNote && codCharge > 0) {
      doc
        .fillColor('#666666')
        .text('COD Charges:', labelX, lineY)
        .fillColor('#000000')
        .text(this.formatCurrency(codCharge), valueX, lineY, { align: 'right' });
      lineY += 15;
    }

    // Line above Order Total
    doc
      .moveTo(370, lineY + 5)
      .lineTo(555, lineY + 5)
      .stroke('#dee2e6');

    // For credit notes, show the total as positive (it's a refund)
    const totalLabel = isCreditNote ? 'Refund Amount:' : 'Order Total:';
    const totalColor = isCreditNote ? '#059669' : '#000000';
    
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(totalColor)
      .text(totalLabel, labelX, lineY + 12)
      .text(this.formatCurrency(Math.abs(invoice.total)), 450, lineY + 12, { width: 100, align: 'right' });

    lineY += 35;

    doc.fillColor('#000000');
    doc.y = lineY + 10;
  }

  /**
   * Add modern footer
   */
  private addModernFooter(doc: any, invoice: Invoice): void {
    const footerY = doc.y + 20;

    if (invoice.status === 'paid') {
      const statusText = 'PAID';
      const dateText = invoice.paidAt ? `Payment received on ${this.formatShortDate(invoice.paidAt)}` : '';

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

    doc.rect(40, 770, 515, 30).fillAndStroke('#1a1a1a', '#1a1a1a');
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor('#ffffff')
      .text('Thank you for your business!', 40, 782, { width: 515, align: 'center' });

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
   * Format currency
   */
  private isCreditNote(invoice: Invoice): boolean {
    return invoice.invoiceNumber?.startsWith('CN-') || false;
  }

  private formatCurrency(amount: number): string {
    // Handle invalid inputs
    if (amount === null || amount === undefined || isNaN(amount)) {
      return 'Rs. 0.00';
    }
    
    // Format manually to avoid locale-specific thousand separators (like single quotes)
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toFixed(2);
    const [integerPart, decimalPart] = formatted.split('.');
    
    // Add commas for Indian numbering system (lakhs and crores)
    let lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    
    return `Rs. ${amount < 0 ? '-' : ''}${formattedInteger}.${decimalPart}`;
  }
}
