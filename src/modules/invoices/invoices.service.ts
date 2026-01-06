import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceType, InvoiceStatus } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { Order } from '../orders/order.entity';
import { OrderItem } from '../orders/order-item.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceDto } from './dto/create-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private invoicePdfService: InvoicePdfService,
    private simpleEmailService: SimpleEmailService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
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

    // Create invoice items
    this.logger.log(`Creating ${order.items.length} invoice items for invoice ${invoice.id}`);
    await this.createInvoiceItems(invoice, order.items);

    // Verify items were created
    const createdItems = await this.invoiceItemRepository.find({
      where: { invoiceId: invoice.id },
    });
    this.logger.log(`Verified: ${createdItems.length} invoice items exist in DB for invoice ${invoice.id}`);
    
    if (createdItems.length === 0) {
      this.logger.error(`CRITICAL: Invoice items were not saved for invoice ${invoice.id}!`);
      throw new Error('Failed to create invoice items');
    }

    // Generate PDF
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(invoice.id);
    
    // Save PDF and update invoice
    const pdfUrl = await this.savePdf(invoice.id, pdfBuffer);
    invoice.pdfUrl = pdfUrl;
    await this.invoiceRepository.save(invoice);

    this.logger.log(`Invoice ${invoice.invoiceNumber} created for order ${order.orderNumber}`);

    return this.findOne(invoice.id);
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
      status: InvoiceStatus.DRAFT,
      orderId: order.id,
      customerId: order.userId,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate,
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      shippingCost: order.shippingCost,
      total: order.total,
      billingName: order.shippingName,
      billingEmail: order.shippingEmail,
      billingPhone: order.shippingPhone,
      billingAddress: order.shippingAddress,
      billingCity: order.shippingCity,
      billingState: order.shippingState,
      billingPostalCode: order.shippingPostalCode,
      billingCountry: order.shippingCountry,
      notes: notes || 'Thank you for your business!',
      terms: terms || 'Payment is due within 30 days of invoice date.',
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
    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.VENDOR,
      status: InvoiceStatus.DRAFT,
      orderId: order.id,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate,
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      shippingCost: order.shippingCost,
      total: order.total,
      commissionAmount: order.commissionAmount,
      commissionRate: order.commissionRate,
      payoutAmount: order.vendorPayout,
      billingName: order.vendor?.businessName || 'Vendor',
      billingEmail: order.vendor?.contactEmail,
      billingPhone: order.vendor?.contactPhone,
      billingAddress: order.vendor?.address,
      billingCity: order.vendor?.city,
      billingState: order.vendor?.state,
      gstNumber: order.vendor?.gstNumber,
      panNumber: order.vendor?.panNumber,
      notes: notes || 'Vendor payout statement',
      terms: terms || 'Payout will be processed within 7 business days.',
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
    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.PLATFORM,
      status: InvoiceStatus.DRAFT,
      orderId: order.id,
      vendorId: order.vendorId,
      invoiceDate,
      dueDate,
      subtotal: order.commissionAmount,
      tax: 0,
      discount: 0,
      shippingCost: 0,
      total: order.commissionAmount,
      commissionAmount: order.commissionAmount,
      commissionRate: order.commissionRate,
      billingName: order.vendor?.businessName || 'Vendor',
      billingEmail: order.vendor?.contactEmail,
      notes: notes || 'Platform commission invoice',
      terms: terms || 'Commission is deducted from vendor payout automatically.',
    });

    return await this.invoiceRepository.save(invoice);
  }

  /**
   * Create invoice items from order items
   */
  private async createInvoiceItems(invoice: Invoice, orderItems: OrderItem[]): Promise<void> {
    if (!orderItems || orderItems.length === 0) {
      this.logger.error(`Cannot create invoice items - no order items provided for invoice ${invoice.id}`);
      throw new Error('No order items to create invoice items from');
    }

    const invoiceItems = orderItems.map(item => {
      this.logger.log(`Creating invoice item: ${item.productName}, qty: ${item.quantity}, price: ${item.price}`);
      return this.invoiceItemRepository.create({
        invoiceId: invoice.id,
        productId: item.productId,
        name: item.productName,
        description: item.variantDetails ? JSON.stringify(item.variantDetails) : '',
        quantity: item.quantity,
        unitPrice: item.price,
        total: Number(item.price) * item.quantity,
        taxAmount: 0, // Tax is calculated at order level
        taxRate: 0,
        hsnCode: item.product?.hsnCode,
      });
    });

    await this.invoiceItemRepository.save(invoiceItems);
    this.logger.log(`Successfully saved ${invoiceItems.length} invoice items for invoice ${invoice.id}`);
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

    // Load invoice items separately
    const items = await this.invoiceItemRepository.find({
      where: { invoiceId: id },
      relations: ['product'],
    });

    return { ...invoice, items } as any;
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

    if (!invoice.pdfUrl) {
      throw new Error('Invoice PDF not generated');
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
   * Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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
   * Delete invoice
   */
  async delete(id: string): Promise<void> {
    const invoice = await this.findOne(id);
    await this.invoiceItemRepository.delete({ invoiceId: id });
    await this.invoiceRepository.remove(invoice);
  }
}
