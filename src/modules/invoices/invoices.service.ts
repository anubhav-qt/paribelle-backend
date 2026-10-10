import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceType, InvoiceStatus } from './invoice.entity';
import { Order } from '../orders/order.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceDto } from './dto/create-invoice.dto';
import { InvoicePdfService } from './invoice-pdf.service';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { ConfigService } from '@nestjs/config';

/**
 * Customer tax invoices, one per paid order, and the credit note that cancels
 * one. (The marketplace's vendor payout, commission, registration and referral
 * invoices are in archive/.)
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private invoicePdfService: InvoicePdfService,
    private simpleEmailService: SimpleEmailService,
    private configService: ConfigService,
  ) {}

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  private generateInvoiceNumber(): string {
    return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async createFromOrder(createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    const { orderId, notes, terms } = createInvoiceDto;

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'items', 'items.product'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!order.items?.length) {
      throw new BadRequestException('Order has no items');
    }

    const invoiceDate = createInvoiceDto.invoiceDate ? new Date(createInvoiceDto.invoiceDate) : new Date();

    // Made once the order is paid, so it is paid in full on the day it is issued.
    const invoice = this.invoiceRepository.create({
      invoiceNumber: this.generateInvoiceNumber(),
      type: InvoiceType.CUSTOMER,
      status: InvoiceStatus.PAID,
      orderId: order.id,
      customerId: order.userId,
      invoiceDate,
      dueDate: invoiceDate,
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount || 0,
      shippingCost: order.shippingCost,
      total: order.total,
      paidAmount: order.total,
      paidAt: invoiceDate,
      billingName: order.billingName || order.shippingName,
      billingEmail: order.billingEmail || order.shippingEmail,
      billingPhone: order.billingPhone || order.shippingPhone,
      billingAddress: order.billingAddress || order.shippingAddress,
      billingCity: order.billingCity || order.shippingCity,
      billingState: order.billingState || order.shippingState,
      billingPostalCode: order.billingPostalCode || order.shippingPostalCode,
      billingCountry: order.billingCountry || order.shippingCountry,
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

    const saved = await this.invoiceRepository.save(invoice);
    this.logger.log(`Invoice ${saved.invoiceNumber} created for order ${order.orderNumber}`);
    return saved;
  }

  private async savePdf(invoiceId: string, pdfBuffer: Buffer): Promise<string> {
    const filename = `invoice-${invoiceId}.pdf`;
    const uploadDir = this.configService.get('UPLOAD_DIR') || './uploads/invoices';
    const filePath = `${uploadDir}/${filename}`;

    const fs = require('fs').promises;
    const path = require('path');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, pdfBuffer);

    return `/uploads/invoices/${filename}`;
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id },
      relations: ['order', 'order.items', 'customer', 'order.items.product'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async findByOrderAndType(orderId: string, type: InvoiceType): Promise<Invoice | null> {
    return this.invoiceRepository.findOne({ where: { orderId, type } });
  }

  async findAll(filters?: {
    status?: InvoiceStatus;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const queryBuilder = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.order', 'order')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .where('invoice.type = :type', { type: InvoiceType.CUSTOMER });

    if (filters?.status) {
      queryBuilder.andWhere('invoice.status = :status', { status: filters.status });
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
    const limit = Math.min(filters?.limit || 20, 100);
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [invoices, total] = await queryBuilder.getManyAndCount();
    return {
      invoices,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

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

    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(invoice.id);
    invoice.pdfUrl = await this.savePdf(invoice.id, pdfBuffer);
    await this.invoiceRepository.save(invoice);

    return this.findOne(id);
  }

  async markAsSent(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.status = InvoiceStatus.SENT;
    invoice.emailSent = true;
    invoice.emailSentAt = new Date();
    return this.invoiceRepository.save(invoice);
  }

  async markAsPaid(id: string): Promise<Invoice> {
    const invoice = await this.findOne(id);
    invoice.status = InvoiceStatus.PAID;
    return this.invoiceRepository.save(invoice);
  }

  async sendInvoice(id: string, sendInvoiceDto?: SendInvoiceDto): Promise<void> {
    const invoice = await this.findOne(id);

    if (!invoice.pdfUrl) {
      const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(invoice.id);
      invoice.pdfUrl = await this.savePdf(invoice.id, pdfBuffer);
      await this.invoiceRepository.save(invoice);
    }

    const recipientEmail = sendInvoiceDto?.recipientEmail || invoice.billingEmail;
    const recipientName = sendInvoiceDto?.recipientEmail ? 'Recipient' : invoice.billingName;
    if (!recipientEmail) {
      throw new BadRequestException('This invoice has no email address to send it to');
    }

    await this.simpleEmailService.sendInvoiceEmail(
      recipientEmail,
      recipientName,
      sendInvoiceDto?.subject || `Invoice ${invoice.invoiceNumber}`,
      sendInvoiceDto?.message ||
        `
        <p>Dear ${invoice.billingName},</p>
        <p>Thank you for your order! Please find attached your invoice ${invoice.invoiceNumber}.</p>
        <p>Invoice Total: ${this.formatCurrency(invoice.total)}</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>PariBelle</p>
      `,
      invoice,
    );

    await this.markAsSent(id);
    this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${recipientEmail}`);
  }

  /** Makes the invoice for any paid order that is missing one. */
  async autoGenerateInvoices(): Promise<{ created: number }> {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.invoices', 'invoices')
      .where('order.paymentStatus = :paymentStatus', { paymentStatus: 'paid' })
      .getMany();

    let created = 0;
    for (const order of orders) {
      if (order.invoices?.some((inv) => inv.type === InvoiceType.CUSTOMER)) continue;
      try {
        await this.createFromOrder({
          orderId: order.id,
          type: InvoiceType.CUSTOMER,
          notes: 'Thank you for your purchase!',
        });
        created++;
      } catch (error) {
        this.logger.error(`Could not create the invoice for order ${order.orderNumber}:`, error);
      }
    }
    return { created };
  }

  async delete(id: string): Promise<void> {
    const invoice = await this.findOne(id);
    await this.invoiceRepository.remove(invoice);
  }

  /** Cancels a paid order's invoice: the same lines, negated, under CN-<number>. */
  async createCreditNote(orderId: string, reason: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['invoices'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const customerInvoice = order.invoices?.find(
      (inv) => inv.type === InvoiceType.CUSTOMER && !inv.invoiceNumber.startsWith('CN-'),
    );
    if (!customerInvoice) return;
    if (order.invoices.some((inv) => inv.invoiceNumber === `CN-${customerInvoice.invoiceNumber}`)) return;

    const subtotal = Number(customerInvoice.subtotal) || 0;
    const tax = Number(customerInvoice.tax) || 0;
    const discount = Number(customerInvoice.discount) || 0;
    const refunded = -(subtotal + tax - discount);

    await this.invoiceRepository.save(
      this.invoiceRepository.create({
        invoiceNumber: `CN-${customerInvoice.invoiceNumber}`,
        type: InvoiceType.CUSTOMER,
        status: InvoiceStatus.PAID,
        orderId: order.id,
        customerId: order.userId,
        invoiceDate: new Date(),
        dueDate: new Date(),
        subtotal: -subtotal,
        tax: -tax,
        discount,
        shippingCost: 0,
        total: refunded,
        paidAmount: refunded,
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
        terms: `This credit note cancels invoice ${customerInvoice.invoiceNumber}.`,
      }),
    );
    this.logger.log(`Credit note CN-${customerInvoice.invoiceNumber} created for order ${order.orderNumber}`);
  }
}
