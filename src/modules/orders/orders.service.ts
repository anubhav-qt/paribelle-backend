import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { MarketplaceGateway } from '../stock/stock.gateway';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { Response } from 'express';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private simpleEmailService: SimpleEmailService,
    private marketplaceGateway: MarketplaceGateway,
    @Inject(forwardRef(() => InvoicesService))
    private invoicesService: InvoicesService,
    @Inject(forwardRef(() => InvoicePdfService))
    private invoicePdfService: InvoicePdfService,
  ) {}

  async create(userId: string, createOrderDto: any) {
    const { items, shippingAddress, paymentMethod, subtotal, shippingCost, tax, totalAmount } = createOrderDto;

    console.log('Create order DTO received:', {
      subtotal, shippingCost, tax, totalAmount,
      itemsCount: items.length,
    });

    // Convert to numbers and ensure proper decimal precision
    const numSubtotal = Number(subtotal) || 0;
    const numShippingCost = Number(shippingCost) || 0;
    const numTax = Number(tax) || 0;
    const numTotalAmount = Number(totalAmount) || 0;

    // Load all products with vendor information
    const productIds = items.map((item: any) => item.productId);
    const products = await this.productRepository.find({
      where: productIds.map(id => ({ id })),
      relations: ['vendor'],
    });

    if (products.length !== items.length) {
      throw new NotFoundException('One or more products not found');
    }

    // Validate stock availability and reserve stock
    const stockUpdates: Array<{ productId: string; stockQuantity: number }> = [];
    
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      // Check if product has enough stock
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`
        );
      }

      // Decrement stock immediately to prevent overselling
      await this.productRepository.decrement(
        { id: product.id },
        'stockQuantity',
        item.quantity
      );

      // Track the new stock quantity for WebSocket broadcast
      const newStockQuantity = product.stockQuantity - item.quantity;
      stockUpdates.push({ 
        productId: product.id, 
        stockQuantity: newStockQuantity 
      });
    }

    // Emit stock updates via WebSocket
    if (stockUpdates.length > 0) {
      this.marketplaceGateway.emitBulkStockUpdate(stockUpdates);
    }

    // Group items by vendorId
    const itemsByVendor = new Map<string, any[]>();
    
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.vendorId) {
        throw new NotFoundException(`Product ${item.productId} not found or has no vendor`);
      }

      if (!itemsByVendor.has(product.vendorId)) {
        itemsByVendor.set(product.vendorId, []);
      }

      itemsByVendor.get(product.vendorId)!.push({
        ...item,
        product,
      });
    }

    console.log(`Creating orders for ${itemsByVendor.size} vendor(s)`);

    // Create separate orders for each vendor
    const createdOrders: Order[] = [];

    for (const [vendorId, vendorItems] of itemsByVendor.entries()) {
      // Get vendor details for snapshot
      const vendor = vendorItems[0].product.vendor;
      
      // Calculate vendor-specific totals
      const vendorSubtotal = vendorItems.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * item.quantity;
      }, 0);

      // Proportionally distribute shipping and tax based on subtotal
      const proportionOfTotal = numSubtotal > 0 ? vendorSubtotal / numSubtotal : 1 / itemsByVendor.size;
      const vendorShippingCost = Number((numShippingCost * proportionOfTotal).toFixed(2));
      const vendorTax = Number((numTax * proportionOfTotal).toFixed(2));
      const vendorTotal = Number((vendorSubtotal + vendorShippingCost + vendorTax).toFixed(2));

      // Calculate commission (10% default)
      const commissionRate = 10;
      const commissionAmount = Number(((vendorTotal * commissionRate) / 100).toFixed(2));
      const vendorPayout = Number((vendorTotal - commissionAmount).toFixed(2));

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      console.log(`Creating order for vendor ${vendorId}:`, {
        orderNumber,
        vendorSubtotal,
        vendorShippingCost,
        vendorTax,
        vendorTotal,
        itemsCount: vendorItems.length,
      });

      // Create order
      const order = this.orderRepository.create({
        orderNumber,
        userId,
        vendorId,
        // Vendor snapshot (for invoices and historical accuracy)
        vendorBusinessName: vendor.businessName,
        vendorStoreName: vendor.storeName,
        vendorGstNumber: vendor.gstNumber,
        vendorAddress: vendor.address,
        vendorCity: vendor.city,
        vendorState: vendor.state,
        vendorPostalCode: vendor.postalCode,
        vendorCountry: vendor.country,
        vendorContactEmail: vendor.contactEmail,
        vendorContactPhone: vendor.contactPhone,
        subtotal: vendorSubtotal,
        tax: vendorTax,
        shippingCost: vendorShippingCost,
        total: vendorTotal,
        commissionRate,
        commissionAmount,
        vendorPayout,
        status: OrderStatus.PENDING,
        paymentStatus: paymentMethod === 'cod' ? PaymentStatus.PENDING : PaymentStatus.PAID, // Mark online payments as paid (when not using Razorpay gateway)
        shippingName: shippingAddress.fullName,
        shippingEmail: '', // TODO: Get from user
        shippingPhone: shippingAddress.phone,
        shippingAddress: `${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? ', ' + shippingAddress.addressLine2 : ''}`,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
      });

      const savedOrder = await this.orderRepository.save(order);

      // Create order items for this vendor
      const orderItems: OrderItem[] = [];
      for (const item of vendorItems) {
        const orderItem = this.orderItemRepository.create({
          orderId: savedOrder.id,
          productId: item.product.id,
          quantity: item.quantity,
          price: Number(item.price) || 0,
          subtotal: Number((Number(item.price) || 0) * item.quantity),
          total: Number((Number(item.price) || 0) * item.quantity),
          productName: item.product.name,
          productSku: item.product.sku || '',
          productImage: item.product.featuredImage,
        });

        orderItems.push(orderItem);
      }

      await this.orderItemRepository.save(orderItems);
      createdOrders.push(savedOrder);
      
      // Emit new order event for vendor
      this.marketplaceGateway.emitNewOrderForVendor(vendorId, {
        id: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        total: vendorTotal,
        itemCount: vendorItems.length,
        status: savedOrder.status,
      });
    }

    console.log(`Created ${createdOrders.length} order(s)`);

    // Return all orders with items
    const ordersWithDetails = await this.orderRepository.find({
      where: createdOrders.map(order => ({ id: order.id })),
      relations: ['items', 'items.product', 'vendor', 'user'],
    });

    return ordersWithDetails;
  }

  async findAll(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor'],
      order: { createdAt: 'DESC' },
    });

    // Transform orders to include shippingAddress as object
    return orders.map(order => this.transformOrder(order));
  }

  async findByUserAndStatus(userId: string, status: OrderStatus) {
    const orders = await this.orderRepository.find({
      where: { userId, status },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor'],
      order: { createdAt: 'DESC' },
    });

    return orders.map(order => this.transformOrder(order));
  }

  async findByVendorId(vendorId: string) {
    // Find all order items where the product belongs to this vendor
    const orderItems = await this.orderItemRepository
      .createQueryBuilder('orderItem')
      .leftJoinAndSelect('orderItem.order', 'order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('orderItem.product', 'product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .where('product.vendorId = :vendorId', { vendorId })
      .orderBy('orderItem.createdAt', 'DESC')
      .getMany();

    // Extract unique orders
    const ordersMap = new Map();
    for (const item of orderItems) {
      if (item.order && !ordersMap.has(item.order.id)) {
        ordersMap.set(item.order.id, item.order);
      }
    }

    const orders = Array.from(ordersMap.values());
    return orders.map(order => this.transformOrder(order));
  }

  async findAllForAdmin() {
    const orders = await this.orderRepository.find({
      relations: ['items', 'items.product', 'vendor', 'user'],
      order: { createdAt: 'DESC' },
    });

    return orders.map(order => this.transformOrder(order));
  }

  async findOne(id: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor', 'payments', 'invoices'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.transformOrder(order);
  }

  private transformOrder(order: Order) {
    // Find customer invoice if available
    const customerInvoice = order.invoices?.find(inv => inv.type === 'customer');
    
    return {
      ...order,
      shippingAddress: {
        fullName: order.shippingName,
        phone: order.shippingPhone,
        addressLine1: order.shippingAddress,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      paymentMethod: order.paymentStatus === 'pending' ? 'cod' : 'razorpay',
      // Add customer invoice info for easy access
      invoice: customerInvoice ? {
        id: customerInvoice.id,
        invoiceNumber: customerInvoice.invoiceNumber,
        invoiceDate: customerInvoice.invoiceDate,
        status: customerInvoice.status,
        downloadUrl: `/api/v1/orders/${order.id}/invoice/download`,
        viewUrl: `/api/v1/invoices/${customerInvoice.id}/pdf`,
      } : null,
    };
  }

  async updateStatus(id: string, status: OrderStatus) {
    const startTime = Date.now();
    console.log(`[updateStatus] Starting status update for order ${id} to ${status}`);
    
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = status;

    if (status === OrderStatus.CONFIRMED) {
      order.confirmedAt = new Date();
    } else if (status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
    } else if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
      
      // Send review request email to buyer (async, don't wait)
      if (order.user && order.user.email) {
        console.log(`[updateStatus] Triggering delivery email for order ${order.orderNumber}`);
        this.simpleEmailService.sendOrderDeliveredEmail(
          order.user.email,
          order.orderNumber,
          order.id,
          order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
        ).catch(error => {
          // Log error but don't fail the status update
          console.error('Failed to send order delivered email:', error);
        });
      }
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
    }

    const savedOrder = await this.orderRepository.save(order);
    
    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, status, order.userId);
    
    const duration = Date.now() - startTime;
    console.log(`[updateStatus] Completed status update for order ${id} in ${duration}ms`);
    
    return savedOrder;
  }

  async updatePaymentStatus(id: string, paymentStatus: string) {
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.paymentStatus;
    order.paymentStatus = paymentStatus as PaymentStatus;
    const savedOrder = await this.orderRepository.save(order);
    
    // Auto-generate customer invoice when payment is completed
    if (paymentStatus === PaymentStatus.PAID && previousStatus !== PaymentStatus.PAID) {
      try {
        console.log(`Payment completed for order ${order.orderNumber}. Generating customer invoice...`);
        await this.invoicesService.createFromOrder({
          orderId: order.id,
          type: 'customer' as any,
          notes: 'Thank you for your purchase!',
        });
        console.log(`Customer invoice generated for order ${order.orderNumber}`);
      } catch (error) {
        console.error(`Failed to generate customer invoice for order ${order.orderNumber}:`, error);
        // Don't throw - payment status update should succeed even if invoice generation fails
      }
    }
    
    return savedOrder;
  }

  async cancel(id: string, userId: string, reason?: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    if (reason) {
      order.customerNotes = (order.customerNotes || '') + `\nCancellation reason: ${reason}`;
    }

    // If order was paid, mark for refund
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
    }

    return this.orderRepository.save(order);
  }

  async requestRefund(id: string, userId: string, reason: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Refund can only be requested for cancelled or delivered orders');
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Only paid orders can be refunded');
    }

    order.paymentStatus = PaymentStatus.REFUNDED;
    order.adminNotes = (order.adminNotes || '') + `\nRefund requested: ${reason} at ${new Date().toISOString()}`;

    return this.orderRepository.save(order);
  }

  async requestReturn(id: string, userId: string, reason: string, itemIds?: string[]) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // Check if return window is still open (e.g., 7 days)
    const deliveredDate = order.deliveredAt;
    if (deliveredDate) {
      const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceDelivery > 7) {
        throw new BadRequestException('Return window has expired (7 days from delivery)');
      }
    }

    const itemList = itemIds && itemIds.length > 0 
      ? `Items: ${itemIds.join(', ')}` 
      : 'All items';
    
    order.customerNotes = (order.customerNotes || '') + 
      `\nReturn requested: ${reason}\n${itemList}\nRequested at: ${new Date().toISOString()}`;
    order.status = OrderStatus.PENDING; // Mark as pending for review

    return this.orderRepository.save(order);
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
  }

  /**
   * Download invoice for a customer's order
   * Only shows customer invoice (not vendor invoice)
   */
  async downloadOrderInvoice(orderId: string, userId: string, res: Response) {
    // Verify order belongs to user
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['invoices'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Find customer invoice
    const customerInvoice = order.invoices?.find(inv => inv.type === 'customer');

    if (!customerInvoice) {
      throw new NotFoundException('Invoice not found for this order. Invoice is generated after delivery.');
    }

    // Generate PDF and send as response
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(customerInvoice.id);
    const invoice = await this.invoicesService.findOne(customerInvoice.id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}
