import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { SimpleEmailService } from '../simple-email/simple-email.service';

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
        subtotal: vendorSubtotal,
        tax: vendorTax,
        shippingCost: vendorShippingCost,
        total: vendorTotal,
        commissionRate,
        commissionAmount,
        vendorPayout,
        status: OrderStatus.PENDING,
        paymentStatus: paymentMethod === 'cod' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
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
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor', 'payments'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.transformOrder(order);
  }

  private transformOrder(order: Order) {
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
    };
  }

  async updateStatus(id: string, status: OrderStatus) {
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
      
      // Send review request email to buyer
      if (order.user && order.user.email) {
        try {
          await this.simpleEmailService.sendOrderDeliveredEmail(
            order.user.email,
            order.orderNumber,
            order.id,
            order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
          );
        } catch (error) {
          // Log error but don't fail the status update
          console.error('Failed to send order delivered email:', error);
        }
      }
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
    }

    return this.orderRepository.save(order);
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
}
