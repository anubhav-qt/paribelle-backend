import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceType, InvoiceStatus } from './invoice.entity';
import { VendorBalance } from './vendor-balance.entity';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceDto } from './dto/create-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../admin/settings.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(VendorBalance)
    private vendorBalanceRepository: Repository<VendorBalance>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    private invoicePdfService: InvoicePdfService,
    private simpleEmailService: SimpleEmailService,
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Format currency helper
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
  }

  /**
   * Generate notes with returned items details
   */
  private generateReturnItemsNotes(returnedItems: any[], reason: string): string {
    if (!returnedItems || returnedItems.length === 0) {
      return `PARTIAL CREDIT NOTE - ${reason}`;
    }
    
    let notes = `PARTIAL CREDIT NOTE - ${reason}\n\nReturned Items:\n`;
    returnedItems.forEach((item, index) => {
      notes += `${index + 1}. ${item.product_name} - Qty: ${item.quantity} - ₹${parseFloat(item.refund_amount || 0).toFixed(2)}\n`;
    });
    
    return notes;
  }

  /**
   * Calculate due date (default: 30 days from invoice date)
   */
  private calculateDueDate(invoiceDate: Date, days: number = 30): Date {
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  /**
   * Create invoice from order
   */
  async createFromOrder(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const { orderId, type, notes, terms } = createInvoiceDto;

    // Load order with all relations
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'vendor', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Log for debugging
    this.logger.log(`Creating invoice for order ${orderId}, type: ${type}, items count: ${order.items?.length || 0}`);
    
    if (!order.items || order.items.length === 0) {
      this.logger.error(`Order ${orderId} has no items! Cannot create invoice.`);
      throw new NotFoundException('Order has no items');
    }

    const invoiceDate = createInvoiceDto.invoiceDate 
      ? new Date(createInvoiceDto.invoiceDate) 
      : new Date();

    const dueDate = createInvoiceDto.dueDate
      ? new Date(createInvoiceDto.dueDate)
      : this.calculateDueDate(invoiceDate);

    // Create invoice based on type
    let invoice: Invoice;

    if (type === InvoiceType.CUSTOMER) {
      invoice = await this.createCustomerInvoice(order, invoiceDate, dueDate, notes, terms);
    } else if (type === InvoiceType.VENDOR) {
      invoice = await this.createVendorInvoice(order, invoiceDate, dueDate, notes, terms);
    } else {
      invoice = await this.createPlatformInvoice(order, invoiceDate, dueDate, notes, terms);
    }

    this.logger.log(`Invoice ${invoice.invoiceNumber} created for order ${order.orderNumber} - items will be loaded from order.items`);

    return invoice;
  }

  /**
   * Create customer invoice
   */
  private async createCustomerInvoice(
    order: Order,
    invoiceDate: Date,
    dueDate: Date,
    notes?: string,
    terms?: string,
  ): Promise<Invoice> {
    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.CUSTOMER,
      status: InvoiceStatus.PAID, // Customer invoices are created after payment, so status is PAID
      orderId: order.id,
      customerId: order.userId,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate: invoiceDate, // For customer invoices, due date = invoice date (already paid)
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount || 0,
      shippingCost: order.shippingCost,
      total: order.total,
      paidAmount: order.total, // Set paid amount since it's already paid
      paidAt: invoiceDate, // Mark payment date as invoice date
      // Use billing address from order (will be same as shipping if user selected "same as shipping")
      billingName: order.billingName || order.shippingName,
      billingEmail: order.billingEmail || order.shippingEmail,
      billingPhone: order.billingPhone || order.shippingPhone,
      billingAddress: order.billingAddress || order.shippingAddress,
      billingCity: order.billingCity || order.shippingCity,
      billingState: order.billingState || order.shippingState,
      billingPostalCode: order.billingPostalCode || order.shippingPostalCode,
      billingCountry: order.billingCountry || order.shippingCountry,
      // Shipping address from order
      shippingName: order.shippingName,
      shippingEmail: order.shippingEmail,
      shippingPhone: order.shippingPhone,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingState: order.shippingState,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      notes: notes || 'Thank you for your business!',
      terms: terms || 'This invoice has been paid in full.',
    });

    return await this.invoiceRepository.save(invoice);
  }

  /**
   * Create vendor payout invoice
   */
  private async createVendorInvoice(
    order: Order,
    invoiceDate: Date,
    dueDate: Date,
    notes?: string,
    terms?: string,
  ): Promise<Invoice> {
    // Calculate commission on subtotal + tax (excluding shipping)
    const commissionRate = order.commissionRate || order.vendor?.commissionRate || 10;
    const commissionBase = order.subtotal + order.tax;
    const commissionAmount = order.commissionAmount || (commissionBase * commissionRate / 100);
    // Vendor gets: (subtotal + tax) - commission + shipping
    const payoutAmount = order.vendorPayout || ((commissionBase - commissionAmount) + order.shippingCost);

    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.VENDOR,
      status: InvoiceStatus.PENDING, // Vendor invoices start as PENDING (payout not processed yet)
      orderId: order.id,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate, // When vendor expects payout
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount || 0,
      shippingCost: order.shippingCost,
      total: order.total, // Full order amount for reference
      commissionAmount, // What platform takes as commission
      commissionRate, // Commission percentage
      payoutAmount, // What vendor receives (subtotal - commission)
      // Vendor's business details (recipient of payout)
      billingName: order.vendor?.businessName || order.vendor?.storeName || 'Vendor',
      billingEmail: order.vendor?.contactEmail || order.vendor?.user?.email,
      billingPhone: order.vendor?.contactPhone,
      billingAddress: order.vendor?.address,
      billingCity: order.vendor?.city,
      billingState: order.vendor?.state,
      billingPostalCode: order.vendor?.pincode,
      billingCountry: order.vendor?.country || 'India',
      gstNumber: order.vendor?.gstNumber,
      panNumber: order.vendor?.panNumber,
      notes: notes || `Vendor payout for Order #${order.orderNumber}. Commission: ${commissionRate}%`,
      terms: terms || 'Payout will be processed within 7 business days of order delivery. Commission deducted from product sales. Shipping cost included in payout. Tax retained by platform for GST remittance.',
    });

    return await this.invoiceRepository.save(invoice);
  }

  /**
   * Create platform commission invoice
   */
  private async createPlatformInvoice(
    order: Order,
    invoiceDate: Date,
    dueDate: Date,
    notes?: string,
    terms?: string,
  ): Promise<Invoice> {
    // Calculate commission on subtotal + tax (excluding shipping)
    const commissionRate = order.commissionRate || order.vendor?.commissionRate || 10;
    const commissionBase = order.subtotal + order.tax;
    const commissionAmount = order.commissionAmount || (commissionBase * commissionRate / 100);
    
    // Platform gets: commission only (calculated on subtotal + tax)
    const platformTotal = commissionAmount;

    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.PLATFORM,
      status: InvoiceStatus.PAID, // Platform commission is auto-deducted, so marked as PAID
      orderId: order.id,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate: invoiceDate, // Platform receives commission immediately
      subtotal: commissionAmount, // Commission on subtotal + tax
      tax: 0, // Tax already factored into commission base
      discount: 0,
      shippingCost: 0, // Shipping excluded from commission
      total: platformTotal, // Commission (10% of subtotal + tax)
      commissionAmount,
      commissionRate,
      paidAmount: platformTotal,
      paidAt: invoiceDate,
      // Vendor details (who is being charged the commission)
      billingName: order.vendor?.businessName || order.vendor?.storeName || 'Vendor',
      billingEmail: order.vendor?.contactEmail || order.vendor?.user?.email,
      billingPhone: order.vendor?.contactPhone,
      gstNumber: order.vendor?.gstNumber,
      panNumber: order.vendor?.panNumber,
      notes: notes || `Platform commission for Order #${order.orderNumber}. Rate: ${commissionRate}%`,
      terms: terms || 'Commission is automatically deducted from vendor payout. Tax amount retained for GST remittance. Shipping handled by vendor.',
    });

    return await this.invoiceRepository.save(invoice);
  }

  /**
   * Save PDF file
   */
  private async savePdf(invoiceId: string, pdfBuffer: Buffer): Promise<string> {
    // In production, upload to S3 or cloud storage
    // For now, we'll save locally or return a data URL
    const filename = `invoice-${invoiceId}.pdf`;
    const uploadDir = this.configService.get('UPLOAD_DIR') || './uploads/invoices';
    const filePath = `${uploadDir}/${filename}`;
    
    // Ensure directory exists
    const fs = require('fs').promises;
    const path = require('path');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);

    // Return relative URL
    return `/uploads/invoices/${filename}`;
  }

  /**
   * Find invoice by ID
   */
  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['order', 'order.items', 'vendor', 'customer', 'order.items.product'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  /**
   * Find invoice by order ID and type
   */
  async findByOrderAndType(orderId: string, type: string): Promise<Invoice | null> {
    const invoice = await this.invoiceRepository.findOne({
      where: { orderId, type: type as InvoiceType },
    });

    return invoice;
  }

  /**
   * Find all invoices with filters
   */
  async findAll(filters?: {
    type?: InvoiceType;
    status?: InvoiceStatus;
    vendorId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .leftJoinAndSelect('invoice.vendor', 'vendor')
      .leftJoinAndSelect('invoice.customer', 'customer');

    if (filters?.type) {
      queryBuilder.andWhere('invoice.type = :type', { type: filters.type });
    }

    if (filters?.status) {
      queryBuilder.andWhere('invoice.status = :status', { status: filters.status });
    }

    if (filters?.vendorId) {
      queryBuilder.andWhere('invoice.vendorId = :vendorId', { vendorId: filters.vendorId });
    }

    if (filters?.customerId) {
      queryBuilder.andWhere('invoice.customerId = :customerId', { customerId: filters.customerId });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('invoice.invoiceDate >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('invoice.invoiceDate <= :endDate', { endDate: filters.endDate });
    }

    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();

    return {
      invoices,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update invoice
   */
  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (updateInvoiceDto.notes !== undefined) {
      invoice.notes = updateInvoiceDto.notes;
    }

    if (updateInvoiceDto.terms !== undefined) {
      invoice.terms = updateInvoiceDto.terms;
    }

    if (updateInvoiceDto.dueDate) {
      invoice.dueDate = new Date(updateInvoiceDto.dueDate);
    }

    await this.invoiceRepository.save(invoice);

    // Regenerate PDF if invoice was updated
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(invoice.id);
    const pdfUrl = await this.savePdf(invoice.id, pdfBuffer);
    invoice.pdfUrl = pdfUrl;
    await this.invoiceRepository.save(invoice);

    return this.findOne(id);
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.status = InvoiceStatus.SENT;
    invoice.emailSent = true;
    invoice.emailSentAt = new Date();
    await this.invoiceRepository.save(invoice);
    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.status = InvoiceStatus.PAID;
    await this.invoiceRepository.save(invoice);
    return invoice;
  }

  /**
   * Send invoice via email
   */
  async sendInvoice(id: string, sendInvoiceDto?: SendInvoiceDto): Promise<void> {
    const invoice = await this.findOne(id);

    // Generate PDF if it doesn't exist
    if (!invoice.pdfUrl) {
      this.logger.log(`Generating PDF for invoice ${invoice.invoiceNumber}...`);
      const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(invoice.id);
      const pdfUrl = await this.savePdf(invoice.id, pdfBuffer);
      invoice.pdfUrl = pdfUrl;
      await this.invoiceRepository.save(invoice);
      this.logger.log(`PDF generated: ${pdfUrl}`);
    }

    let recipientEmail: string;
    let recipientName: string;

    if (sendInvoiceDto?.recipientEmail) {
      recipientEmail = sendInvoiceDto.recipientEmail;
      recipientName = 'Recipient';
    } else if (invoice.type === InvoiceType.CUSTOMER) {
      recipientEmail = invoice.billingEmail;
      recipientName = invoice.billingName;
    } else if (invoice.type === InvoiceType.VENDOR) {
      recipientEmail = invoice.vendor.contactEmail;
      recipientName = invoice.vendor.businessName;
    } else {
      throw new Error('No recipient email specified');
    }

    const subject = sendInvoiceDto?.subject || `Invoice ${invoice.invoiceNumber}`;
    const message = sendInvoiceDto?.message || this.getDefaultEmailMessage(invoice);

    // Send email with PDF attachment
    await this.simpleEmailService.sendInvoiceEmail(
      recipientEmail,
      recipientName,
      subject,
      message,
      invoice,
    );

    // Mark as sent
    await this.markAsSent(id);

    this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${recipientEmail}`);
  }

  /**
   * Get default email message based on invoice type
   */
  private getDefaultEmailMessage(invoice: Invoice): string {
    if (invoice.type === InvoiceType.CUSTOMER) {
      return `
        <p>Dear ${invoice.billingName},</p>
        <p>Thank you for your order! Please find attached your invoice ${invoice.invoiceNumber}.</p>
        <p>Invoice Total: ${this.formatCurrency(invoice.total)}</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>The Team</p>
      `;
    } else if (invoice.type === InvoiceType.VENDOR) {
      return `
        <p>Dear ${invoice.billingName},</p>
        <p>Please find attached your payout statement ${invoice.invoiceNumber}.</p>
        <p>Payout Amount: ${this.formatCurrency(invoice.payoutAmount)}</p>
        <p>Commission: ${this.formatCurrency(invoice.commissionAmount)} (${invoice.commissionRate}%)</p>
        <p>Best regards,<br>The Team</p>
      `;
    } else {
      return `
        <p>Dear ${invoice.billingName},</p>
        <p>Please find attached your commission invoice ${invoice.invoiceNumber}.</p>
        <p>Commission Amount: ${this.formatCurrency(invoice.total)}</p>
        <p>Best regards,<br>The Team</p>
      `;
    }
  }

  /**
   * Auto-generate invoices for completed orders
   * Note: Customer invoices are now generated automatically on payment
   * This method handles vendor payout invoices for delivered orders
   */
  async autoGenerateInvoices(): Promise<void> {
    // Find all delivered+paid orders
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.vendor', 'vendor')
      .leftJoinAndSelect('order.invoices', 'invoices')
      .where('order.status = :status', { status: 'delivered' })
      .andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: 'paid' })
      .getMany();

    this.logger.log(`Checking ${orders.length} delivered orders for invoice generation`);

    for (const order of orders) {
      try {
        this.logger.log(`Processing order ${order.orderNumber} with ${order.items?.length || 0} items`);
        
        if (!order.items || order.items.length === 0) {
          this.logger.error(`Skipping order ${order.orderNumber} - no items found`);
          continue;
        }

        const hasCustomerInvoice = order.invoices?.some(inv => inv.type === InvoiceType.CUSTOMER);
        const hasVendorInvoice = order.invoices?.some(inv => inv.type === InvoiceType.VENDOR);

        // Create customer invoice if missing (fallback for orders paid before this feature)
        if (!hasCustomerInvoice) {
          this.logger.log(`Creating missing customer invoice for order ${order.orderNumber}`);
          await this.createFromOrder({
            orderId: order.id,
            type: InvoiceType.CUSTOMER,
            notes: 'Thank you for your purchase!',
          });
        }

        // Create vendor payout invoice for delivered orders
        if (!hasVendorInvoice) {
          this.logger.log(`Creating vendor payout invoice for order ${order.orderNumber}`);
          await this.createFromOrder({
            orderId: order.id,
            type: InvoiceType.VENDOR,
            notes: 'Vendor payout for delivered order',
          });
        }

        this.logger.log(`Processed invoices for order ${order.orderNumber}`);
      } catch (error) {
        this.logger.error(`Error generating invoices for order ${order.orderNumber}:`, error);
      }
    }
  }

  /**
   * Create vendor deduction invoice for returns/cancellations
   * Reuses existing createFromOrder but with negative amounts
   */
  async createVendorDeductionInvoice(orderId: string, reason: string): Promise<Invoice> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'vendor', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if deduction invoice already exists
    const existingDeduction = await this.invoiceRepository.findOne({
      where: { 
        orderId,
        type: InvoiceType.VENDOR,
        notes: reason,
      },
    });

    if (existingDeduction) {
      this.logger.warn(`Deduction invoice already exists for order ${orderId}`);
      return existingDeduction;
    }

    // Create negative vendor invoice using existing method
    const invoice = await this.createVendorInvoice(
      order,
      new Date(),
      new Date(),
      `Deduction: ${reason}`,
      'Amount deducted from vendor payout'
    );

    // Make amounts negative
    invoice.subtotal = -Math.abs(invoice.subtotal);
    invoice.total = -Math.abs(invoice.total);
    invoice.payoutAmount = -Math.abs(invoice.payoutAmount || 0);
    invoice.commissionAmount = Math.abs(invoice.commissionAmount || 0); // Commission is reversed (positive)

    await this.invoiceRepository.save(invoice);

    // Update vendor balance
    await this.updateVendorBalance(order.vendorId);

    this.logger.log(`Deduction invoice created for order ${order.orderNumber}`);
    return invoice;
  }

  /**
   * Update vendor balance based on all their invoices
   */
  async updateVendorBalance(vendorId: string): Promise<VendorBalance> {
    // Get or create vendor balance
    let balance = await this.vendorBalanceRepository.findOne({
      where: { vendorId },
    });

    if (!balance) {
      balance = this.vendorBalanceRepository.create({ vendorId });
    }

    // Calculate totals from all vendor invoices
    const invoices = await this.invoiceRepository.find({
      where: { vendorId, type: InvoiceType.VENDOR },
    });

    let totalSales = 0;
    let totalDeductions = 0;
    let totalCommission = 0;

    invoices.forEach(invoice => {
      if (invoice.total > 0) {
        // Positive invoice = payout
        totalSales += Number(invoice.total);
        totalCommission += Number(invoice.commissionAmount || 0);
      } else {
        // Negative invoice = deduction
        totalDeductions += Math.abs(Number(invoice.total));
      }
    });

    balance.totalSales = totalSales;
    balance.totalDeductions = totalDeductions;
    balance.totalCommission = totalCommission;
    balance.invoiceCount = invoices.length;
    balance.availableBalance = totalSales - totalDeductions - totalCommission - balance.paidOut;
    balance.pendingPayout = balance.availableBalance;

    return await this.vendorBalanceRepository.save(balance);
  }

  /**
   * Get vendor balance
   */
  async getVendorBalance(vendorId: string): Promise<VendorBalance> {
    const balance = await this.vendorBalanceRepository.findOne({
      where: { vendorId },
      relations: ['vendor'],
    });

    if (!balance) {
      // Create and return new balance
      return this.updateVendorBalance(vendorId);
    }

    return balance;
  }

  /**
   * Get vendor statement for a period
   */
  async getVendorStatement(vendorId: string, startDate?: Date, endDate?: Date) {
    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.vendorId = :vendorId', { vendorId })
      .andWhere('invoice.type = :type', { type: InvoiceType.VENDOR })
      .leftJoinAndSelect('invoice.order', 'order')
      .orderBy('invoice.createdAt', 'DESC');

    if (startDate) {
      query.andWhere('invoice.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('invoice.createdAt <= :endDate', { endDate });
    }

    const invoices = await query.getMany();
    const balance = await this.getVendorBalance(vendorId);

    // Separate payouts and deductions
    const payouts = invoices.filter(inv => inv.total > 0);
    const deductions = invoices.filter(inv => inv.total < 0);

    const totalPayouts = payouts.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalDeductionAmount = deductions.reduce((sum, inv) => sum + Math.abs(Number(inv.total)), 0);
    const totalCommissionAmount = invoices.reduce((sum, inv) => sum + Number(inv.commissionAmount || 0), 0);

    return {
      vendorId,
      period: { startDate, endDate },
      balance,
      summary: {
        totalPayouts,
        totalDeductions: totalDeductionAmount,
        totalCommission: totalCommissionAmount,
        netAmount: totalPayouts - totalDeductionAmount - totalCommissionAmount,
        invoiceCount: invoices.length,
        payoutCount: payouts.length,
        deductionCount: deductions.length,
      },
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        orderId: inv.orderId,
        orderNumber: inv.order?.orderNumber,
        type: inv.total > 0 ? 'payout' : 'deduction',
        amount: Number(inv.total),
        commission: Number(inv.commissionAmount || 0),
        status: inv.status,
        date: inv.createdAt,
        notes: inv.notes,
      })),
    };
  }

  /**
   * Reconcile vendor balance (recalculate from all invoices)
   */
  async reconcileVendorBalance(vendorId: string): Promise<VendorBalance> {
    this.logger.log(`Reconciling balance for vendor ${vendorId}`);
    return await this.updateVendorBalance(vendorId);
  }

  /**
   * Generate vendor invoices for all delivered+paid orders without invoices
   */
  async generateMissingVendorInvoices(): Promise<{ created: number; skipped: number }> {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.vendor', 'vendor')
      .leftJoinAndSelect('order.invoices', 'invoices')
      .where('order.status = :status', { status: 'delivered' })
      .andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: 'paid' })
      .getMany();

    let created = 0;
    let skipped = 0;

    for (const order of orders) {
      try {
        const hasVendorInvoice = order.invoices?.some(inv => inv.type === InvoiceType.VENDOR && inv.total > 0);

        if (!hasVendorInvoice) {
          // Reuse existing createFromOrder method
          await this.createFromOrder({
            orderId: order.id,
            type: InvoiceType.VENDOR,
            notes: 'Vendor payout for delivered order',
          });
          
          // Update vendor balance
          await this.updateVendorBalance(order.vendorId);
          
          created++;
          this.logger.log(`Created vendor invoice for order ${order.orderNumber}`);
        } else {
          skipped++;
        }
      } catch (error) {
        this.logger.error(`Error generating vendor invoice for order ${order.orderNumber}:`, error);
        skipped++;
      }
    }

    this.logger.log(`Vendor invoice generation complete: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  /**
   * Delete invoice
   */
  async delete(id: string): Promise<void> {
    const invoice = await this.findOne(id);
    // Note: No need to delete invoice_items - they don't exist anymore
    await this.invoiceRepository.remove(invoice);
  }

  /**
   * Create credit notes for all invoice types (customer, vendor, platform)
   * Used when orders are cancelled or returned
   */
  async createCreditNote(orderId: string, reason: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'vendor', 'items', 'items.product', 'invoices'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Creating credit notes for order ${order.orderNumber}. Reason: ${reason}`);

    // Get existing invoices for this order
    const existingInvoices = order.invoices || [];

    // Create credit note for customer invoice (refund to customer)
    const customerInvoice = existingInvoices.find(inv => inv.type === InvoiceType.CUSTOMER);
    if (customerInvoice) {
      try {
        const subtotal = Number(customerInvoice.subtotal) || 0;
        const tax = Number(customerInvoice.tax) || 0;
        const discount = Number(customerInvoice.discount) || 0;
        
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${customerInvoice.invoiceNumber}`,
          type: InvoiceType.CUSTOMER,
          status: InvoiceStatus.PAID, // Credit note is processed immediately
          orderId: order.id,
          customerId: order.userId,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: -subtotal, // Negative amounts for credit notes
          tax: -tax,
          discount: discount, // Keep discount positive (it was a reduction, so credit note shows same reduction)
          shippingCost: 0, // Shipping cost is non-refundable for returns/cancellations
          total: -(subtotal + tax - discount), // Total without shipping
          paidAmount: -(subtotal + tax - discount),
          paidAt: new Date(),
          billingName: customerInvoice.billingName,
          billingEmail: customerInvoice.billingEmail,
          billingPhone: customerInvoice.billingPhone,
          billingAddress: customerInvoice.billingAddress,
          billingCity: customerInvoice.billingCity,
          billingState: customerInvoice.billingState,
          billingPostalCode: customerInvoice.billingPostalCode,
          billingCountry: customerInvoice.billingCountry,
          shippingName: customerInvoice.shippingName,
          shippingEmail: customerInvoice.shippingEmail,
          shippingPhone: customerInvoice.shippingPhone,
          shippingAddress: customerInvoice.shippingAddress,
          shippingCity: customerInvoice.shippingCity,
          shippingState: customerInvoice.shippingState,
          shippingPostalCode: customerInvoice.shippingPostalCode,
          shippingCountry: customerInvoice.shippingCountry,
          notes: `CREDIT NOTE - ${reason}`,
          terms: `This credit note refunds the original invoice ${customerInvoice.invoiceNumber}.`,
        });
        await this.invoiceRepository.save(creditNote);
        this.logger.log(`Customer credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create customer credit note for order ${order.orderNumber}:`, error);
      }
    }

    // Create credit note for vendor invoice (vendor returns product value only, keeps commission & shipping)
    const vendorInvoice = existingInvoices.find(inv => inv.type === InvoiceType.VENDOR);
    if (vendorInvoice) {
      try {
        // Fair model: Vendor returns (subtotal + tax - commission), keeps shipping
        // This means marketplace takes the loss on commission
        const subtotal = Number(vendorInvoice.subtotal) || 0;
        const tax = Number(vendorInvoice.tax) || 0;
        const discount = Number(vendorInvoice.discount) || 0;
        const commissionAmount = Number(vendorInvoice.commissionAmount) || 0;
        const commissionRate = Number(vendorInvoice.commissionRate) || 0;
        
        const amountToReturn = -(subtotal + tax - commissionAmount);
        
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${vendorInvoice.invoiceNumber}`,
          type: InvoiceType.VENDOR,
          status: InvoiceStatus.PENDING,
          orderId: order.id,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: -subtotal,
          tax: -tax,
          discount: discount, // Keep discount positive (it was a reduction)
          shippingCost: 0, // Vendor keeps shipping cost
          total: -(subtotal + tax - discount), // Total without shipping
          commissionAmount: commissionAmount, // Show as positive (vendor keeps it)
          commissionRate: commissionRate,
          payoutAmount: amountToReturn, // Amount vendor owes back (excludes shipping and commission)
          billingName: vendorInvoice.billingName,
          billingEmail: vendorInvoice.billingEmail,
          billingPhone: vendorInvoice.billingPhone,
          billingAddress: vendorInvoice.billingAddress,
          billingCity: vendorInvoice.billingCity,
          billingState: vendorInvoice.billingState,
          billingPostalCode: vendorInvoice.billingPostalCode,
          billingCountry: vendorInvoice.billingCountry,
          gstNumber: vendorInvoice.gstNumber,
          panNumber: vendorInvoice.panNumber,
          notes: `CREDIT NOTE - ${reason}. Vendor keeps commission and shipping. Marketplace absorbs commission loss.`,
          terms: `Vendor returns product value only. Shipping retained by vendor. Commission not charged back.`,
        });
        await this.invoiceRepository.save(creditNote);
        
        // Update vendor balance
        if (order.vendorId) {
          await this.updateVendorBalance(order.vendorId);
        }
        
        this.logger.log(`Vendor credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create vendor credit note for order ${order.orderNumber}:`, error);
      }
    }

    // Create credit note for platform invoice (platform loses commission)
    const platformInvoice = existingInvoices.find(inv => inv.type === InvoiceType.PLATFORM);
    if (platformInvoice) {
      try {
        const subtotal = Number(platformInvoice.subtotal) || 0;
        const tax = Number(platformInvoice.tax) || 0;
        const total = Number(platformInvoice.total) || 0;
        const commissionAmount = Number(platformInvoice.commissionAmount) || 0;
        const commissionRate = Number(platformInvoice.commissionRate) || 0;
        
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${platformInvoice.invoiceNumber}`,
          type: InvoiceType.PLATFORM,
          status: InvoiceStatus.PAID,
          orderId: order.id,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: -subtotal,
          tax: -tax,
          total: -total,
          commissionAmount: -commissionAmount, // Platform loses commission
          commissionRate: commissionRate,
          notes: `CREDIT NOTE - ${reason}. Platform commission reversal.`,
          terms: `This credit note reverses the commission from invoice ${platformInvoice.invoiceNumber}.`,
        });
        await this.invoiceRepository.save(creditNote);
        this.logger.log(`Platform credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create platform credit note for order ${order.orderNumber}:`, error);
      }
    }

    this.logger.log(`Credit notes creation completed for order ${order.orderNumber}`);
  }

  /**
   * Create partial credit note for specific returned items
   */
  async createPartialCreditNote(
    orderId: string, 
    returnedItemAmount: number,
    returnedItemTax: number,
    returnedCommission: number,
    reason: string,
    returnedItems?: any[]
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'vendor', 'items', 'items.product', 'invoices'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.logger.log(`Creating partial credit notes for order ${order.orderNumber}. Amount: ${returnedItemAmount}, Tax: ${returnedItemTax}`);

    const existingInvoices = order.invoices || [];

    // Create partial credit note for customer (refund returned items)
    const customerInvoice = existingInvoices.find(inv => inv.type === InvoiceType.CUSTOMER);
    if (customerInvoice) {
      try {
        const refundSubtotal = -returnedItemAmount;
        const refundTax = -returnedItemTax;
        const refundTotal = refundSubtotal + refundTax;
        
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${customerInvoice.invoiceNumber}-${Date.now().toString().slice(-6)}`,
          type: InvoiceType.CUSTOMER,
          status: InvoiceStatus.PAID,
          orderId: order.id,
          customerId: order.userId,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: refundSubtotal,
          tax: refundTax,
          discount: 0,
          shippingCost: 0,
          total: refundTotal,
          paidAmount: refundTotal,
          paidAt: new Date(),
          billingName: customerInvoice.billingName,
          billingEmail: customerInvoice.billingEmail,
          billingPhone: customerInvoice.billingPhone,
          billingAddress: customerInvoice.billingAddress,
          billingCity: customerInvoice.billingCity,
          billingState: customerInvoice.billingState,
          billingPostalCode: customerInvoice.billingPostalCode,
          billingCountry: customerInvoice.billingCountry,
          shippingName: customerInvoice.shippingName,
          shippingEmail: customerInvoice.shippingEmail,
          shippingPhone: customerInvoice.shippingPhone,
          shippingAddress: customerInvoice.shippingAddress,
          shippingCity: customerInvoice.shippingCity,
          shippingState: customerInvoice.shippingState,
          shippingPostalCode: customerInvoice.shippingPostalCode,
          shippingCountry: customerInvoice.shippingCountry,
          notes: this.generateReturnItemsNotes(returnedItems || [], reason),
          terms: `Partial refund for returned items from invoice ${customerInvoice.invoiceNumber}.`,
        });
        await this.invoiceRepository.save(creditNote);
        
        this.logger.log(`Customer partial credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create customer partial credit note:`, error);
      }
    }

    // Create partial credit note for vendor (deduct returned item value)
    const vendorInvoice = existingInvoices.find(inv => inv.type === InvoiceType.VENDOR);
    if (vendorInvoice) {
      try {
        const vendorReturnAmount = -(returnedItemAmount + returnedItemTax - returnedCommission);
        
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${vendorInvoice.invoiceNumber}-${Date.now().toString().slice(-6)}`,
          type: InvoiceType.VENDOR,
          status: InvoiceStatus.PENDING,
          orderId: order.id,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: -returnedItemAmount,
          tax: -returnedItemTax,
          discount: 0,
          shippingCost: 0,
          total: -(returnedItemAmount + returnedItemTax),
          commissionAmount: returnedCommission,
          commissionRate: vendorInvoice.commissionRate,
          payoutAmount: vendorReturnAmount,
          billingName: vendorInvoice.billingName,
          billingEmail: vendorInvoice.billingEmail,
          billingPhone: vendorInvoice.billingPhone,
          billingAddress: vendorInvoice.billingAddress,
          billingCity: vendorInvoice.billingCity,
          billingState: vendorInvoice.billingState,
          billingPostalCode: vendorInvoice.billingPostalCode,
          billingCountry: vendorInvoice.billingCountry,
          gstNumber: vendorInvoice.gstNumber,
          panNumber: vendorInvoice.panNumber,
          notes: `PARTIAL CREDIT NOTE - ${reason}. Vendor returns product value minus commission.`,
          terms: `Partial deduction for returned items from invoice ${vendorInvoice.invoiceNumber}.`,
        });
        await this.invoiceRepository.save(creditNote);
        
        if (order.vendorId) {
          await this.updateVendorBalance(order.vendorId);
        }
        
        this.logger.log(`Vendor partial credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create vendor partial credit note:`, error);
      }
    }

    // Create partial credit note for platform (reverse commission on returned items)
    const platformInvoice = existingInvoices.find(inv => inv.type === InvoiceType.PLATFORM);
    if (platformInvoice) {
      try {
        const creditNote = this.invoiceRepository.create({
          invoiceNumber: `CN-${platformInvoice.invoiceNumber}-${Date.now().toString().slice(-6)}`,
          type: InvoiceType.PLATFORM,
          status: InvoiceStatus.PAID,
          orderId: order.id,
          vendorId: order.vendorId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subtotal: -returnedCommission,
          tax: 0,
          total: -returnedCommission,
          commissionAmount: -returnedCommission,
          commissionRate: platformInvoice.commissionRate,
          notes: `PARTIAL CREDIT NOTE - ${reason}. Platform commission reversal for returned items.`,
          terms: `Partial commission reversal from invoice ${platformInvoice.invoiceNumber}.`,
        });
        await this.invoiceRepository.save(creditNote);
        this.logger.log(`Platform partial credit note created: ${creditNote.invoiceNumber}`);
      } catch (error) {
        this.logger.error(`Failed to create platform partial credit note:`, error);
      }
    }

    this.logger.log(`Partial credit notes creation completed for order ${order.orderNumber}`);
  }

  /**
   * Create registration invoice for vendor
   */
  async createRegistrationInvoice(
    vendor: Vendor,
    referralDiscount: number = 0,
  ): Promise<Invoice> {
    // Get registration cost from settings
    const registrationCost = Number(
      await this.settingsService.getSetting('VENDOR_REGISTRATION_COST'),
    ) || 5000;

    const subtotal = registrationCost;
    const discount = referralDiscount;
    const tax = 0; // No tax on registration fee
    const total = subtotal - discount + tax;

    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.REGISTRATION,
      status: InvoiceStatus.PENDING,
      vendorId: vendor.id,
      invoiceDate: new Date(),
      dueDate: this.calculateDueDate(new Date(), 7), // 7 days to pay
      subtotal,
      tax,
      discount,
      total,
      billingName: vendor.businessName || vendor.storeName,
      billingEmail: vendor.contactEmail,
      billingPhone: vendor.contactPhone,
      billingAddress: vendor.address,
      billingCity: vendor.city,
      billingState: vendor.state,
      billingPostalCode: vendor.postalCode,
      billingCountry: vendor.country,
      notes: referralDiscount > 0
        ? `Vendor registration fee with referral discount of ${this.formatCurrency(referralDiscount)}.`
        : 'Vendor registration fee.',
      terms: 'Payment must be completed within 7 days to activate your vendor account.',
    });

    return this.invoiceRepository.save(invoice);
  }

  /**
   * Create referral credit invoice (credit note for referrer)
   */
  async createReferralCreditInvoice(
    referrerId: string,
    creditAmount: number,
    registrationInvoiceId: string,
  ): Promise<Invoice> {
    // Get the registration invoice to link
    const registrationInvoice = await this.invoiceRepository.findOne({
      where: { id: registrationInvoiceId },
      relations: ['vendor'],
    });

    if (!registrationInvoice) {
      throw new NotFoundException('Registration invoice not found');
    }

    const invoice = this.invoiceRepository.create({
      invoiceNumber: `RC-${registrationInvoice.invoiceNumber}`,
      type: InvoiceType.REFERRAL_CREDIT,
      status: InvoiceStatus.PAID,
      vendorId: registrationInvoice.vendorId,
      invoiceDate: new Date(),
      dueDate: new Date(),
      subtotal: creditAmount,
      tax: 0,
      discount: 0,
      total: creditAmount,
      paidAmount: creditAmount,
      paidAt: new Date(),
      notes: `Referral credit for bringing in vendor: ${registrationInvoice.vendor?.storeName || 'Unknown'}.`,
      terms: `This credit has been added to your wallet/vendor balance.`,
    });

    return this.invoiceRepository.save(invoice);
  }

  /**
   * Find registration invoice for vendor
   */
  async findRegistrationInvoice(vendorId: string): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({
      where: {
        vendorId,
        type: InvoiceType.REGISTRATION,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    invoiceId: string,
    paymentId: string,
    amount: number,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    invoice.status = InvoiceStatus.PAID;
    invoice.paidAmount = amount;
    invoice.paidAt = new Date();
    invoice.notes = `${invoice.notes || ''}\nPayment ID: ${paymentId}`;

    return this.invoiceRepository.save(invoice);
  }
}
