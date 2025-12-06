import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(userId: string, createOrderDto: any) {
    const { items, shippingAddress, paymentMethod, subtotal, shippingCost, tax, totalAmount } = createOrderDto;

    console.log('Create order DTO received:', {
      subtotal, shippingCost, tax, totalAmount,
      subtotalType: typeof subtotal,
      totalAmountType: typeof totalAmount,
    });

    // Convert to numbers and ensure proper decimal precision
    const numSubtotal = Number(subtotal) || 0;
    const numShippingCost = Number(shippingCost) || 0;
    const numTax = Number(tax) || 0;
    const numTotalAmount = Number(totalAmount) || 0;

    console.log('Converted values:', {
      numSubtotal, numShippingCost, numTax, numTotalAmount,
    });

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Get first product's vendor (assuming single vendor per order for now)
    const firstProduct = await this.productRepository.findOne({
      where: { id: items[0].productId },
      relations: ['vendor'],
    });

    if (!firstProduct) {
      throw new NotFoundException('Product not found');
    }

    // Calculate commission (10% default)
    const commissionRate = 10;
    const commissionAmount = Number(((numTotalAmount * commissionRate) / 100).toFixed(2));
    const vendorPayout = Number((numTotalAmount - commissionAmount).toFixed(2));

    console.log('Commission calculations:', {
      commissionRate,
      commissionAmount,
      vendorPayout,
    });

    // Create order
    const order = this.orderRepository.create({
      orderNumber,
      userId,
      vendorId: firstProduct.vendorId,
      subtotal: numSubtotal,
      tax: numTax,
      shippingCost: numShippingCost,
      total: numTotalAmount,
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

    console.log('Order object before save:', {
      total: order.total,
      subtotal: order.subtotal,
      tax: order.tax,
      shippingCost: order.shippingCost,
    });

    const savedOrder = await this.orderRepository.save(order);

    console.log('Saved order:', {
      id: savedOrder.id,
      total: savedOrder.total,
      subtotal: savedOrder.subtotal,
    });

    // Create order items
    const orderItems: OrderItem[] = [];
    for (const item of items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      const orderItem = this.orderItemRepository.create({
        orderId: savedOrder.id,
        productId: product.id,
        quantity: item.quantity,
        price: Number(item.price) || 0,
        subtotal: Number((Number(item.price) || 0) * item.quantity),
        total: Number((Number(item.price) || 0) * item.quantity),
        productName: product.name,
        productSku: product.sku || '',
        productImage: product.featuredImage,
      });

      console.log('Order item created:', {
        productName: orderItem.productName,
        price: orderItem.price,
        quantity: orderItem.quantity,
        total: orderItem.total,
      });

      orderItems.push(orderItem);
    }

    await this.orderItemRepository.save(orderItems);

    // Return order with items
    return this.orderRepository.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'items.product', 'vendor', 'user'],
    });
  }

  async findAll(userId: string) {
    return this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForAdmin() {
    return this.orderRepository.find({
      relations: ['items', 'items.product', 'vendor', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor', 'payments'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.orderRepository.findOne({ where: { id } });

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
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
    }

    return this.orderRepository.save(order);
  }

  async cancel(id: string, userId: string) {
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

    return this.orderRepository.save(order);
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
  }
}
