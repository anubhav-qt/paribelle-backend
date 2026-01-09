import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { MarketplaceGateway } from '../stock/stock.gateway';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private simpleEmailService: SimpleEmailService,
    private marketplaceGateway: MarketplaceGateway,
    @Inject(forwardRef(() => InvoicesService))
    private invoicesService: InvoicesService,
    @Inject(forwardRef(() => InvoicePdfService))
    private invoicePdfService: InvoicePdfService,
    private platformSettingsService: PlatformSettingsService,
    private dataSource: DataSource,
  ) {}

  async create(userId: string, createOrderDto: any) {
    const { items, shippingAddress, billingAddress, paymentMethod, subtotal, shippingCost, tax, totalAmount, useWalletBalance } = createOrderDto;

    console.log('Create order DTO received:', {
      subtotal, shippingCost, tax, totalAmount,
      itemsCount: items.length,
      useWalletBalance,
    });

    // Convert to numbers and ensure proper decimal precision
    let numSubtotal = Number(subtotal) || 0;
    let numShippingCost = Number(shippingCost) || 0;
    let numTax = Number(tax) || 0;
    let numTotalAmount = Number(totalAmount) || 0;

    // Get user's wallet balance
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Apply wallet balance if requested
    let walletAmountUsed = 0;
    let finalAmountToPay = numTotalAmount;

    if (useWalletBalance && user.walletBalance > 0) {
      walletAmountUsed = Math.min(user.walletBalance, numTotalAmount);
      finalAmountToPay = Number((numTotalAmount - walletAmountUsed).toFixed(2));
      
      console.log('Wallet balance applied:', {
        availableBalance: user.walletBalance,
        walletAmountUsed,
        originalTotal: numTotalAmount,
        finalAmountToPay,
      });
    }

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

      // Only check stock for products with inventory tracking enabled
      if (product.trackInventory) {
        // Ensure stockQuantity is a valid number (handle null/undefined)
        const availableStock = product.stockQuantity ?? 0;
        
        // Check if product has enough stock
        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${item.quantity}`
          );
        }

        // Decrement stock immediately to prevent overselling
        await this.productRepository.decrement(
          { id: product.id },
          'stockQuantity',
          item.quantity
        );

        // Track the new stock quantity for WebSocket broadcast
        const newStockQuantity = availableStock - item.quantity;
        stockUpdates.push({ 
          productId: product.id, 
          stockQuantity: newStockQuantity 
        });
      }
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
      // Extract base price (without tax) from each item
      const vendorSubtotal = vendorItems.reduce((sum, item) => {
        const itemPrice = Number(item.price) || 0;
        const product = item.product;
        const priceType = product.priceType || 'mrp_with_gst';
        const gstRate = Number(product.gstRate) || 18;

        let basePrice = itemPrice;
        if (priceType === 'mrp_with_gst') {
          // Extract base price from tax-inclusive price
          basePrice = itemPrice / (1 + gstRate / 100);
        }
        // For 'selling_price_without_gst', basePrice is already the price

        return sum + basePrice * item.quantity;
      }, 0);

      // Calculate vendor tax from items
      const vendorTaxFromItems = vendorItems.reduce((sum, item) => {
        const itemPrice = Number(item.price) || 0;
        const product = item.product;
        const priceType = product.priceType || 'mrp_with_gst';
        const gstRate = Number(product.gstRate) || 18;

        let itemTax = 0;
        if (priceType === 'mrp_with_gst') {
          // Extract tax from inclusive price
          const basePrice = itemPrice / (1 + gstRate / 100);
          itemTax = itemPrice - basePrice;
        } else {
          // Calculate tax on exclusive price
          itemTax = itemPrice * (gstRate / 100);
        }

        return sum + itemTax * item.quantity;
      }, 0);

      // Proportionally distribute shipping based on subtotal
      const proportionOfTotal = numSubtotal > 0 ? vendorSubtotal / numSubtotal : 1 / itemsByVendor.size;
      const vendorShippingCost = Number((numShippingCost * proportionOfTotal).toFixed(2));
      const vendorTax = Number(vendorTaxFromItems.toFixed(2));
      const vendorTotal = Number((vendorSubtotal + vendorShippingCost + vendorTax).toFixed(2));

      // Calculate commission on subtotal + tax (excluding shipping)
      const commissionRate = 10;
      const commissionBase = vendorSubtotal + vendorTax; // Base for commission calculation
      const commissionAmount = Number((commissionBase * commissionRate / 100).toFixed(2));
      const vendorPayout = Number((commissionBase - commissionAmount + vendorShippingCost).toFixed(2));

      // Generate order number
      const orderNumber = this.generateOrderNumber();

      console.log(`Creating order for vendor ${vendorId}:`, {
        orderNumber,
        vendorSubtotal,
        vendorShippingCost,
        vendorTax,
        vendorTotal,
        commissionAmount,
        vendorPayout,
        itemsCount: vendorItems.length,
      });

      // Proportionally apply wallet discount to this vendor's order
      const vendorWalletDiscount = walletAmountUsed > 0 
        ? Number((walletAmountUsed * proportionOfTotal).toFixed(2))
        : 0;
      const vendorFinalTotal = Number((vendorTotal - vendorWalletDiscount).toFixed(2));

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
        discount: vendorWalletDiscount,
        total: vendorFinalTotal > 0 ? vendorFinalTotal : vendorTotal,
        commissionRate,
        commissionAmount,
        vendorPayout,
        status: OrderStatus.PENDING,
        paymentStatus: paymentMethod === 'cod' ? PaymentStatus.PENDING : PaymentStatus.PAID, // Mark online payments as paid (when not using Razorpay gateway)
        shippingName: shippingAddress.fullName,
        shippingEmail: shippingAddress.email || '', // Use from address if available
        shippingPhone: shippingAddress.phone,
        shippingAddress: `${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? ', ' + shippingAddress.addressLine2 : ''}`,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        shippingCountry: shippingAddress.country,
        shippingPostalCode: shippingAddress.postalCode,
        // Billing address (use billing if provided, otherwise same as shipping)
        billingAddressSameAsShipping: !billingAddress || JSON.stringify(billingAddress) === JSON.stringify(shippingAddress),
        billingName: billingAddress?.fullName || shippingAddress.fullName,
        billingEmail: billingAddress?.email || shippingAddress.email || '',
        billingPhone: billingAddress?.phone || shippingAddress.phone,
        billingAddress: billingAddress 
          ? `${billingAddress.addressLine1}${billingAddress.addressLine2 ? ', ' + billingAddress.addressLine2 : ''}`
          : `${shippingAddress.addressLine1}${shippingAddress.addressLine2 ? ', ' + shippingAddress.addressLine2 : ''}`,
        billingCity: billingAddress?.city || shippingAddress.city,
        billingState: billingAddress?.state || shippingAddress.state,
        billingCountry: billingAddress?.country || shippingAddress.country,
        billingPostalCode: billingAddress?.postalCode || shippingAddress.postalCode,
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

    // Deduct wallet balance if it was used
    if (walletAmountUsed > 0) {
      await this.userRepository.update(userId, {
        walletBalance: () => `wallet_balance - ${walletAmountUsed}`,
      });
      console.log(`Deducted ${walletAmountUsed} from user wallet. Remaining balance: ${user.walletBalance - walletAmountUsed}`);
    }

    // Return all orders with items
    const ordersWithDetails = await this.orderRepository.find({
      where: createdOrders.map(order => ({ id: order.id })),
      relations: ['items', 'items.product', 'vendor', 'user'],
    });

    // Auto-generate invoices for orders that are already paid
    for (const order of ordersWithDetails) {
      if (order.paymentStatus === PaymentStatus.PAID) {
        try {
          console.log(`Order ${order.orderNumber} is already paid. Generating invoices...`);
          
          // Check if customer invoice already exists
          const existingCustomerInvoice = await this.invoicesService.findByOrderAndType(order.id, 'customer');
          if (!existingCustomerInvoice) {
            await this.invoicesService.createFromOrder({
              orderId: order.id,
              type: 'customer' as any,
              notes: 'Thank you for your purchase!',
            });
            console.log(`Customer invoice generated for order ${order.orderNumber}`);
          }
          
          // Check if vendor invoice already exists
          const existingVendorInvoice = await this.invoicesService.findByOrderAndType(order.id, 'vendor');
          if (!existingVendorInvoice) {
            await this.invoicesService.createFromOrder({
              orderId: order.id,
              type: 'vendor' as any,
              notes: `Vendor payout for order ${order.orderNumber}`,
            });
            console.log(`Vendor invoice generated for order ${order.orderNumber}`);
          }
          
          // Check if platform invoice already exists
          const existingPlatformInvoice = await this.invoicesService.findByOrderAndType(order.id, 'platform');
          if (!existingPlatformInvoice) {
            await this.invoicesService.createFromOrder({
              orderId: order.id,
              type: 'platform' as any,
              notes: `Platform commission for order ${order.orderNumber}`,
            });
            console.log(`Platform invoice generated for order ${order.orderNumber}`);
          }
        } catch (error) {
          console.error(`Failed to generate invoices for order ${order.orderNumber}:`, error);
          // Don't throw - order creation should succeed even if invoice generation fails
        }
      }
    }

    return ordersWithDetails;
  }

  async findAll(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'vendor', 'invoices'],
      order: { createdAt: 'DESC' },
    });

    // Fetch returns for all order items
    const orderIds = orders.map(o => o.id);
    let returnsData: any[] = [];
    
    if (orderIds.length > 0) {
      const returnsQuery = `
        SELECT r.*, oi.order_id 
        FROM returns r
        INNER JOIN order_items oi ON r.order_item_id = oi.id
        WHERE oi.order_id = ANY($1)
        ORDER BY r.created_at DESC
      `;
      returnsData = await this.dataSource.query(returnsQuery, [orderIds]);
    }

    // Group returns by order_id
    const returnsByOrder: Record<string, any[]> = returnsData.reduce((acc: Record<string, any[]>, ret: any) => {
      if (!acc[ret.order_id]) {
        acc[ret.order_id] = [];
      }
      acc[ret.order_id].push({
        id: ret.id,
        returnNumber: ret.return_number,
        orderItemId: ret.order_item_id,
        productName: ret.product_name,
        product_sku: ret.product_sku,
        quantity: ret.quantity,
        originalQuantity: ret.original_quantity,
        refundAmount: parseFloat(ret.refund_amount),
        refundTotal: parseFloat(ret.refund_total),
        reason: ret.reason,
        status: ret.status,
        requestedAt: ret.requested_at,
        approvedAt: ret.approved_at,
        rejectedAt: ret.rejected_at,
        receivedAt: ret.received_at,
        refundedAt: ret.refunded_at,
        cancelledAt: ret.cancelled_at,
        rejectionReason: ret.rejection_reason,
        customerNotes: ret.customer_notes,
        adminNotes: ret.admin_notes,
        vendorNotes: ret.vendor_notes,
        trackingNumber: ret.tracking_number,
        carrier: ret.carrier,
        images: ret.images
      });
      return acc;
    }, {});

    // Transform orders to include shippingAddress as object and returns
    return orders.map(order => {
      const transformed = this.transformOrder(order);
      return {
        ...transformed,
        returns: returnsByOrder[order.id] || []
      };
    });
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

    // Fetch returns data for all orders
    const orderIds = orders.map(o => o.id);
    const returnsData = orderIds.length > 0 ? await this.dataSource.query(
      `SELECT * FROM returns WHERE order_id = ANY($1) ORDER BY requested_at DESC`,
      [orderIds]
    ) : [];

    // Group returns by order ID
    const returnsByOrder = returnsData.reduce((acc: any, ret: any) => {
      if (!acc[ret.order_id]) {
        acc[ret.order_id] = [];
      }
      acc[ret.order_id].push({
        id: ret.id,
        returnNumber: ret.return_number,
        orderItemId: ret.order_item_id,
        productName: ret.product_name,
        product_sku: ret.product_sku,
        quantity: ret.quantity,
        originalQuantity: ret.original_quantity,
        refundAmount: parseFloat(ret.refund_amount),
        refundTotal: parseFloat(ret.refund_total),
        reason: ret.reason,
        status: ret.status,
        requestedAt: ret.requested_at,
        approvedAt: ret.approved_at,
        rejectedAt: ret.rejected_at,
        receivedAt: ret.received_at,
        refundedAt: ret.refunded_at,
        cancelledAt: ret.cancelled_at,
        rejectionReason: ret.rejection_reason,
        customerNotes: ret.customer_notes,
        adminNotes: ret.admin_notes,
        vendorNotes: ret.vendor_notes,
        trackingNumber: ret.tracking_number,
        carrier: ret.carrier,
        images: ret.images
      });
      return acc;
    }, {});

    // Transform orders to include returns
    return orders.map(order => {
      const transformed = this.transformOrder(order);
      return {
        ...transformed,
        returns: returnsByOrder[order.id] || []
      };
    });
  }

  async findAllForAdmin() {
    const orders = await this.orderRepository.find({
      relations: ['items', 'items.product', 'vendor', 'user', 'invoices'],
      order: { createdAt: 'DESC' },
    });

    // Fetch returns data for all orders
    const orderIds = orders.map(o => o.id);
    const returnsData = orderIds.length > 0 ? await this.dataSource.query(
      `SELECT * FROM returns WHERE order_id = ANY($1) ORDER BY requested_at DESC`,
      [orderIds]
    ) : [];

    // Group returns by order ID
    const returnsByOrder = returnsData.reduce((acc: any, ret: any) => {
      if (!acc[ret.order_id]) {
        acc[ret.order_id] = [];
      }
      acc[ret.order_id].push({
        id: ret.id,
        returnNumber: ret.return_number,
        orderItemId: ret.order_item_id,
        productName: ret.product_name,
        product_sku: ret.product_sku,
        quantity: ret.quantity,
        originalQuantity: ret.original_quantity,
        refundAmount: parseFloat(ret.refund_amount),
        refundTotal: parseFloat(ret.refund_total),
        reason: ret.reason,
        status: ret.status,
        requestedAt: ret.requested_at,
        approvedAt: ret.approved_at,
        rejectedAt: ret.rejected_at,
        receivedAt: ret.received_at,
        refundedAt: ret.refunded_at,
        cancelledAt: ret.cancelled_at,
        rejectionReason: ret.rejection_reason,
        customerNotes: ret.customer_notes,
        adminNotes: ret.admin_notes,
        vendorNotes: ret.vendor_notes,
        trackingNumber: ret.tracking_number,
        carrier: ret.carrier,
        images: ret.images
      });
      return acc;
    }, {});

    // Transform orders to include returns
    return orders.map(order => {
      const transformed = this.transformOrder(order);
      return {
        ...transformed,
        returns: returnsByOrder[order.id] || []
      };
    });
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
    
    // Get return policy from the first product's vendor (assuming single-vendor orders)
    const vendor = order.items?.[0]?.product?.vendor;
    const returnPolicyDays = vendor?.returnPolicyDays ?? 7;
    const allowReturns = vendor?.allowReturns ?? true;
    
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
      // Add return policy information
      returnPolicy: {
        allowReturns,
        returnPolicyDays,
        vendorName: vendor?.storeName || vendor?.businessName,
      },
    };
  }

  async updateStatus(id: string, status: OrderStatus) {
    const startTime = Date.now();
    console.log(`[updateStatus] Starting status update for order ${id} to ${status}`);
    
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;
    order.status = status;

    if (status === OrderStatus.CONFIRMED) {
      order.confirmedAt = new Date();
      // Send confirmation email
      if (order.user && order.user.email) {
        this.simpleEmailService.sendOrderConfirmationEmail(
          order.user.email,
          order.orderNumber,
          order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
        ).catch(error => {
          console.error('Failed to send order confirmation email:', error);
        });
      }
    } else if (status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
      // Send shipping notification email
      if (order.user && order.user.email) {
        this.simpleEmailService.sendOrderShippedEmail(
          order.user.email,
          order.orderNumber,
          order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
        ).catch(error => {
          console.error('Failed to send order shipped email:', error);
        });
      }
    } else if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
      
      // Send delivery notification and review request email
      if (order.user && order.user.email) {
        console.log(`[updateStatus] Triggering delivery email for order ${order.orderNumber}`);
        this.simpleEmailService.sendOrderDeliveredEmail(
          order.user.email,
          order.orderNumber,
          order.id,
          order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
        ).catch(error => {
          console.error('Failed to send order delivered email:', error);
        });
      }
      
      // Auto-generate vendor invoice when order is delivered
      if (order.paymentStatus === PaymentStatus.PAID) {
        try {
          console.log(`Order delivered: ${order.orderNumber}. Generating vendor invoice...`);
          
          // Check if vendor invoice already exists
          const existingVendorInvoice = await this.invoicesService.findByOrderAndType(order.id, 'vendor');
          if (!existingVendorInvoice) {
            await this.invoicesService.createFromOrder({
              orderId: order.id,
              type: 'vendor' as any,
              notes: `Vendor payout for delivered order ${order.orderNumber}`,
            });
            console.log(`Vendor invoice generated for order ${order.orderNumber}`);
          } else {
            console.log(`Vendor invoice already exists for order ${order.orderNumber}`);
          }
        } catch (error) {
          console.error(`Failed to generate vendor invoice for order ${order.orderNumber}:`, error);
          // Don't throw - status update should succeed even if invoice generation fails
        }
      }
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
      
      // Restore stock quantities for cancelled order
      if (order.items && order.items.length > 0) {
        console.log(`[updateStatus] Restoring stock for cancelled order ${order.orderNumber}`);
        for (const item of order.items) {
          await this.productRepository.increment(
            { id: item.productId },
            'stockQuantity',
            item.quantity
          );
          
          // Get updated product stock and broadcast via WebSocket
          const product = await this.productRepository.findOne({ 
            where: { id: item.productId } 
          });
          if (product) {
            this.marketplaceGateway.emitStockUpdate(
              product.id,
              product.stockQuantity
            );
            console.log(`[updateStatus] Restored ${item.quantity} units to product ${product.id}. New stock: ${product.stockQuantity}`);
          }
        }
      }
      
      // Send cancellation email
      if (order.user && order.user.email) {
        this.simpleEmailService.sendOrderCancelledEmail(
          order.user.email,
          order.orderNumber,
          order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
        ).catch(error => {
          console.error('Failed to send order cancelled email:', error);
        });
      }

      // Create credit note (negative invoice) for cancelled order
      if (order.paymentStatus === 'paid') {
        try {
          console.log(`[updateStatus] Creating credit note for cancelled order ${order.orderNumber}`);
          await this.invoicesService.createCreditNote(order.id, 'Order cancelled');
        } catch (error) {
          console.error('Failed to create credit note for cancelled order:', error);
        }
      }
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
    
    // Auto-generate customer and platform invoices when payment is completed
    if (paymentStatus === PaymentStatus.PAID && previousStatus !== PaymentStatus.PAID) {
      try {
        console.log(`Payment completed for order ${order.orderNumber}. Generating invoices...`);
        
        // Check if customer invoice already exists
        const existingCustomerInvoice = await this.invoicesService.findByOrderAndType(order.id, 'customer');
        if (!existingCustomerInvoice) {
          await this.invoicesService.createFromOrder({
            orderId: order.id,
            type: 'customer' as any,
            notes: 'Thank you for your purchase!',
          });
          console.log(`Customer invoice generated for order ${order.orderNumber}`);
        } else {
          console.log(`Customer invoice already exists for order ${order.orderNumber}`);
        }
        
        // Check if vendor invoice already exists
        const existingVendorInvoice = await this.invoicesService.findByOrderAndType(order.id, 'vendor');
        if (!existingVendorInvoice) {
          await this.invoicesService.createFromOrder({
            orderId: order.id,
            type: 'vendor' as any,
            notes: `Vendor payout for order ${order.orderNumber}`,
          });
          console.log(`Vendor invoice generated for order ${order.orderNumber}`);
        } else {
          console.log(`Vendor invoice already exists for order ${order.orderNumber}`);
        }
        
        // Check if platform invoice already exists
        const existingPlatformInvoice = await this.invoicesService.findByOrderAndType(order.id, 'platform');
        if (!existingPlatformInvoice) {
          await this.invoicesService.createFromOrder({
            orderId: order.id,
            type: 'platform' as any,
            notes: `Platform commission for order ${order.orderNumber}`,
          });
          console.log(`Platform invoice generated for order ${order.orderNumber}`);
        } else {
          console.log(`Platform invoice already exists for order ${order.orderNumber}`);
        }
      } catch (error) {
        console.error(`Failed to generate invoices for order ${order.orderNumber}:`, error);
        // Don't throw - payment status update should succeed even if invoice generation fails
      }
    }
    
    return savedOrder;
  }

  async cancel(id: string, userId: string, reason?: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['items', 'items.product', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    // Restore stock quantities
    console.log(`[cancel] Restoring stock for cancelled order ${order.orderNumber}`);
    for (const item of order.items) {
      await this.productRepository.increment(
        { id: item.productId },
        'stockQuantity',
        item.quantity
      );
      
      // Get updated product stock and broadcast via WebSocket
      const product = await this.productRepository.findOne({ 
        where: { id: item.productId } 
      });
      if (product) {
        this.marketplaceGateway.emitStockUpdate(
          product.id,
          product.stockQuantity
        );
        console.log(`[cancel] Restored ${item.quantity} units to product ${product.id}. New stock: ${product.stockQuantity}`);
      }
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    if (reason) {
      order.customerNotes = (order.customerNotes || '') + `\nCancellation reason: ${reason}`;
    }

    // If order was paid, mark for refund and create credit note
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
      
      try {
        console.log(`[cancel] Creating credit note for cancelled order ${order.orderNumber}`);
        await this.invoicesService.createCreditNote(order.id, reason || 'Order cancelled by customer');
      } catch (error) {
        console.error('Failed to create credit note for cancelled order:', error);
      }
    }

    // Send cancellation email
    if (order.user && order.user.email) {
      this.simpleEmailService.sendOrderCancelledEmail(
        order.user.email,
        order.orderNumber,
        order.shippingName || `${order.user.firstName} ${order.user.lastName}` || 'Customer',
      ).catch(error => {
        console.error('Failed to send order cancelled email:', error);
      });
    }

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.CANCELLED, order.userId);

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
      relations: ['items', 'items.product', 'items.product.vendor', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // Get return policy from first product's vendor (assuming single-vendor orders)
    const vendor = order.items[0]?.product?.vendor;
    let returnPolicyDays = 7; // Default fallback
    let allowReturns = true;

    if (vendor) {
      returnPolicyDays = vendor.returnPolicyDays ?? 7;
      allowReturns = vendor.allowReturns ?? true;

      if (!allowReturns) {
        throw new BadRequestException('This vendor does not accept returns');
      }

      if (returnPolicyDays === 0) {
        throw new BadRequestException('Returns are not allowed for this vendor');
      }
    }

    // Check if return window is still open based on vendor's policy
    const deliveredDate = order.deliveredAt;
    if (deliveredDate) {
      const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceDelivery > returnPolicyDays) {
        throw new BadRequestException(
          `Return window has expired (${returnPolicyDays} days from delivery). Order was delivered ${daysSinceDelivery} days ago.`
        );
      }
    }

    // Restore stock quantities for returned items
    console.log(`[requestReturn] Restoring stock for returned order ${order.orderNumber}`);
    const itemsToReturn = itemIds && itemIds.length > 0 
      ? order.items.filter(item => itemIds.includes(item.id))
      : order.items;
    
    // Note: Inventory is NOT restored at request time
    // It will be restored when admin approves the return

    const itemList = itemIds && itemIds.length > 0 
      ? `Items: ${itemIds.join(', ')}` 
      : 'All items';
    
    order.customerNotes = (order.customerNotes || '') + 
      `\nReturn requested: ${reason}\n${itemList}\nRequested at: ${new Date().toISOString()}`;
    order.status = OrderStatus.RETURN_REQUESTED;
    order.returnReason = reason;

    // Note: Return is only requested, not approved yet
    // Payment status and inventory remain unchanged until admin approves
    // Admin can approve the return using approveReturn() method

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.RETURN_REQUESTED, order.userId);

    const savedOrder = await this.orderRepository.save(order);
    
    // Send return confirmation email (you can add this method to SimpleEmailService)
    // this.simpleEmailService.sendOrderReturnedEmail(...)
    
    return savedOrder;
  }

  async requestItemReturn(
    orderId: string,
    orderItemId: string,
    userId: string,
    quantity: number,
    reason: string,
    customerNotes?: string,
    images?: string[]
  ) {
    // Find the order and order item
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    const orderItem = order.items.find(item => item.id === orderItemId);
    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }

    // Check vendor return policy
    const vendor = orderItem.product?.vendor;
    let returnPolicyDays = 7;
    let allowReturns = true;

    if (vendor) {
      returnPolicyDays = vendor.returnPolicyDays ?? 7;
      allowReturns = vendor.allowReturns ?? true;

      if (!allowReturns) {
        throw new BadRequestException('This vendor does not accept returns');
      }

      if (returnPolicyDays === 0) {
        throw new BadRequestException('Returns are not allowed for this vendor');
      }
    }

    // Check return window
    const deliveredDate = order.deliveredAt;
    if (deliveredDate) {
      const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceDelivery > returnPolicyDays) {
        throw new BadRequestException(
          `Return window has expired (${returnPolicyDays} days from delivery). Order was delivered ${daysSinceDelivery} days ago.`
        );
      }
    }

    // Check if quantity is valid
    if (quantity <= 0 || quantity > orderItem.quantity) {
      throw new BadRequestException('Invalid return quantity');
    }

    // Generate return number
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `RET-${dateStr}-${randomNum}`;

    // Calculate refund amounts
    // Note: orderItem.price is the price per unit that customer paid
    // We should refund exactly what they paid, not add tax on top
    const itemPrice = parseFloat(orderItem.price.toString());
    const refundTotal = itemPrice * quantity;
    
    // Split the refund into base amount and tax (assuming 18% GST is included in price)
    // If price includes tax: base = total / 1.18, tax = total - base
    const refundAmount = refundTotal / 1.18;
    const refundTax = refundTotal - refundAmount;

    // Get vendor ID from the order
    const vendorId = order.vendorId || orderItem.product?.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Vendor information not found for this order');
    }

    // Insert return record directly
    const insertQuery = `
      INSERT INTO returns (
        return_number, order_id, order_item_id, user_id, vendor_id,
        product_name, quantity, original_quantity, original_price,
        refund_amount, refund_tax, refund_total,
        reason, customer_notes, images, status,
        requested_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const returnRecord = await this.dataSource.query(insertQuery, [
      returnNumber,
      orderId,
      orderItemId,
      userId,
      vendorId,
      orderItem.productName,
      quantity,
      orderItem.quantity,
      itemPrice,
      refundAmount,
      refundTax,
      refundTotal,
      reason,
      customerNotes || null,
      images ? JSON.stringify(images) : null,
      'requested',
      new Date(),
      new Date(),
      new Date()
    ]);

    // Update order status to RETURN_REQUESTED
    order.status = OrderStatus.RETURN_REQUESTED;
    await this.orderRepository.save(order);

    // Emit event
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.RETURN_REQUESTED, order.userId);

    return {
      success: true,
      message: 'Return request submitted successfully',
      data: returnRecord[0]
    };
  }

  /**
   * Request returns for multiple items in a single transaction
   */
  async requestBulkReturns(
    orderId: string,
    userId: string,
    items: Array<{
      orderItemId: string;
      quantity: number;
      reason: string;
      customerNotes?: string;
      images?: string[];
    }>
  ) {
    try {
      console.log('[requestBulkReturns] Starting bulk return request', { orderId, userId, itemsCount: items.length });
      
      // Validate request
      if (!items || items.length === 0) {
        throw new BadRequestException('No items provided for return');
      }

    // Fetch order once
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.product', 'items.product.vendor', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // Check vendor return policy (from first item)
    const vendor = order.items[0]?.product?.vendor;
    let returnPolicyDays = 7;
    let allowReturns = true;

    if (vendor) {
      returnPolicyDays = vendor.returnPolicyDays ?? 7;
      allowReturns = vendor.allowReturns ?? true;

      if (!allowReturns) {
        throw new BadRequestException('This vendor does not accept returns');
      }

      if (returnPolicyDays === 0) {
        throw new BadRequestException('Returns are not allowed for this vendor');
      }
    }

    // Check return window
    const deliveredDate = order.deliveredAt;
    if (deliveredDate) {
      const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceDelivery > returnPolicyDays) {
        throw new BadRequestException(
          `Return window has expired (${returnPolicyDays} days from delivery). Order was delivered ${daysSinceDelivery} days ago.`
        );
      }
    }

    // Get vendor ID
    const vendorId = order.vendorId || order.items[0]?.product?.vendorId;
    if (!vendorId) {
      throw new BadRequestException('Vendor information not found for this order');
    }

    // Process all return requests
    const returnRecords: any[] = [];
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    for (const item of items) {
      // Find the order item
      const orderItem = order.items.find(oi => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new NotFoundException(`Order item ${item.orderItemId} not found`);
      }

      // Validate quantity
      if (item.quantity <= 0 || item.quantity > orderItem.quantity) {
        throw new BadRequestException(`Invalid return quantity for item ${orderItem.productName}`);
      }

      // Generate unique return number
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const returnNumber = `RET-${dateStr}-${randomNum}`;

      // Calculate refund amounts
      const itemPrice = parseFloat(orderItem.price.toString());
      const refundTotal = itemPrice * item.quantity;
      const refundAmount = refundTotal / 1.18;
      const refundTax = refundTotal - refundAmount;

      // Insert return record
      const insertQuery = `
        INSERT INTO returns (
          return_number, order_id, order_item_id, user_id, vendor_id,
          product_name, quantity, original_quantity, original_price,
          refund_amount, refund_tax, refund_total,
          reason, customer_notes, images, status,
          requested_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;

      const returnRecord = await this.dataSource.query(insertQuery, [
        returnNumber,
        orderId,
        orderItem.id,
        userId,
        vendorId,
        orderItem.productName,
        item.quantity,
        orderItem.quantity,
        itemPrice,
        refundAmount.toFixed(2),
        refundTax.toFixed(2),
        refundTotal.toFixed(2),
        item.reason,
        item.customerNotes || null,
        item.images ? JSON.stringify(item.images) : null,
        'requested',
        new Date(),
        new Date(),
        new Date()
      ]);

      returnRecords.push(returnRecord[0]);
    }

    // Update order status to RETURN_REQUESTED
    order.status = OrderStatus.RETURN_REQUESTED;
    await this.orderRepository.save(order);

    // Emit event
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.RETURN_REQUESTED, order.userId);

    return {
      success: true,
      message: `${returnRecords.length} return request(s) submitted successfully`,
      data: returnRecords
    };
    } catch (error) {
      console.error('[requestBulkReturns] Error:', error);
      throw error;
    }
  }

  /**
   * Approve all return requests for an order
   */
  async approveAllReturns(orderId: string) {
    // Get all requested returns for this order
    const returns = await this.dataSource.query(
      `SELECT * FROM returns WHERE order_id = $1 AND status = 'requested'`,
      [orderId]
    );

    if (!returns || returns.length === 0) {
      throw new NotFoundException('No pending return requests found for this order');
    }

    // Approve all returns
    await this.dataSource.query(
      `UPDATE returns 
       SET status = 'approved', approved_at = $1, updated_at = $2 
       WHERE order_id = $3 AND status = 'requested'`,
      [new Date(), new Date(), orderId]
    );

    // Update order status to RETURN_APPROVED
    await this.orderRepository.update(
      { id: orderId },
      { status: OrderStatus.RETURN_APPROVED }
    );

    // Emit WebSocket event
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (order) {
      this.marketplaceGateway.emitOrderStatusUpdate(
        orderId,
        OrderStatus.RETURN_APPROVED,
        order.userId
      );
    }

    return {
      success: true,
      message: `${returns.length} return request(s) approved. Customer can now ship items back.`,
      approvedCount: returns.length
    };
  }

  /**
   * Reject all return requests for an order
   */
  async rejectAllReturns(orderId: string, reason: string) {
    // Get all requested returns for this order
    const returns = await this.dataSource.query(
      `SELECT * FROM returns WHERE order_id = $1 AND status = 'requested'`,
      [orderId]
    );

    if (!returns || returns.length === 0) {
      throw new NotFoundException('No pending return requests found for this order');
    }

    // Reject all returns
    await this.dataSource.query(
      `UPDATE returns 
       SET status = 'rejected', rejected_at = $1, rejection_reason = $2, updated_at = $3 
       WHERE order_id = $4 AND status = 'requested'`,
      [new Date(), reason, new Date(), orderId]
    );

    // Update order status back to DELIVERED
    await this.orderRepository.update(
      { id: orderId },
      { status: OrderStatus.DELIVERED }
    );

    // Emit WebSocket event
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (order) {
      this.marketplaceGateway.emitOrderStatusUpdate(
        orderId,
        OrderStatus.DELIVERED,
        order.userId
      );
    }

    return {
      success: true,
      message: `${returns.length} return request(s) rejected.`,
      rejectedCount: returns.length
    };
  }

  /**
   * Confirm all approved returns - restore stock and create single credit note
   */
  async confirmAllReturns(orderId: string) {
    // Get all approved returns for this order with order item details
    const returns = await this.dataSource.query(
      `SELECT r.*, oi.product_id, oi.variant_id 
       FROM returns r 
       JOIN order_items oi ON r.order_item_id = oi.id
       WHERE r.order_id = $1 AND r.status = 'approved'`,
      [orderId]
    );

    if (!returns || returns.length === 0) {
      throw new NotFoundException('No approved returns found for this order');
    }

    // Get order details
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'user', 'vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Restore stock for each return item
    for (const returnItem of returns) {
      console.log(`[confirmAllReturns] Processing return item:`, {
        id: returnItem.id,
        product_id: returnItem.product_id,
        variant_id: returnItem.variant_id,
        quantity: returnItem.quantity
      });

      // Check if it's a variant or regular product
      if (returnItem.variant_id) {
        const result = await this.dataSource.query(
          `UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2 RETURNING stock_quantity`,
          [returnItem.quantity, returnItem.variant_id]
        );
        console.log(`[confirmAllReturns] Restored ${returnItem.quantity} units to variant ${returnItem.variant_id}. New stock: ${result[0]?.stock_quantity}`);
        
        // Emit WebSocket for variant's product
        if (returnItem.product_id) {
          const product = await this.productRepository.findOne({
            where: { id: returnItem.product_id }
          });
          if (product) {
            this.marketplaceGateway.emitStockUpdate(
              product.id,
              product.stockQuantity
            );
          }
        }
      } else if (returnItem.product_id) {
        await this.productRepository.increment(
          { id: returnItem.product_id },
          'stockQuantity',
          returnItem.quantity
        );
        
        // Get updated product stock and broadcast via WebSocket
        const product = await this.productRepository.findOne({
          where: { id: returnItem.product_id }
        });
        if (product) {
          this.marketplaceGateway.emitStockUpdate(
            product.id,
            product.stockQuantity
          );
          console.log(`[confirmAllReturns] Restored ${returnItem.quantity} units to product ${returnItem.product_id}. New stock: ${product.stockQuantity}`);
        }
      }

      // Update return status to received
      await this.dataSource.query(
        `UPDATE returns 
         SET status = 'received', received_at = $1, updated_at = $2 
         WHERE id = $3`,
        [new Date(), new Date(), returnItem.id]
      );
    }

    // Update order status to RETURNED
    await this.orderRepository.update(
      { id: orderId },
      { 
        status: OrderStatus.RETURNED,
        returnedAt: new Date()
      }
    );

    // Create a single consolidated credit note for all returns
    try {
      // Calculate totals from all returns
      const totalRefundAmount = returns.reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0);
      const totalRefundTax = returns.reduce((sum, r) => sum + parseFloat(r.refund_tax || 0), 0);
      
      // Calculate commission on returned amount (assuming commission rate from order)
      const commissionRate = order.commissionRate || 0;
      const returnedCommission = totalRefundAmount * (commissionRate / 100);

      await this.invoicesService.createPartialCreditNote(
        orderId,
        totalRefundAmount,
        totalRefundTax,
        returnedCommission,
        `Return of ${returns.length} item(s)`,
        returns  // Pass the actual returned items
      );
      console.log(`[confirmAllReturns] Created consolidated credit note for order ${orderId}`);
    } catch (error) {
      console.error('Failed to create consolidated credit note:', error);
    }

    // Emit WebSocket event
    this.marketplaceGateway.emitOrderStatusUpdate(
      orderId,
      OrderStatus.RETURNED,
      order.userId
    );

    return {
      success: true,
      message: `${returns.length} return(s) confirmed. Stock restored and credit note created.`,
      confirmedCount: returns.length
    };
  }

  /**
   * Approve a return request (Admin only)
   * This allows customer to ship the item back but does NOT process refund yet
   */
  async approveReturnRequest(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'user', 'vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.RETURN_REQUESTED) {
      throw new BadRequestException('Order does not have a pending return request');
    }

    // Update order status to approved - customer can now ship back
    order.status = OrderStatus.RETURN_APPROVED;
    order.returnApprovedAt = new Date();
    order.adminNotes = (order.adminNotes || '') + 
      `\nReturn request approved at: ${new Date().toISOString()}\nWaiting for customer to ship item back.`;

    // Note: Payment status remains PAID, inventory unchanged
    // Refund will be processed only after receiving and verifying the item

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.RETURN_APPROVED, order.userId);

    const savedOrder = await this.orderRepository.save(order);
    
    // Send return approved email with return shipping instructions
    try {
      const platformSettings = await this.platformSettingsService.getPlatformSettings();
      
      await this.simpleEmailService.sendReturnApprovalEmail(
        order.user.email,
        order.shippingName,
        order.orderNumber,
        order.returnReason || 'Customer requested return',
        {
          name: platformSettings.businessName || 'Marketplace',
          addressLine1: platformSettings.registeredAddressLine1 || '',
          city: platformSettings.registeredCity || '',
          state: platformSettings.registeredState || '',
          postalCode: platformSettings.registeredPincode || '',
          country: platformSettings.registeredCountry || '',
          phone: platformSettings.businessPhone || '',
        }
      );
      console.log(`[approveReturnRequest] Return approval email sent to ${order.user.email}`);
    } catch (error) {
      console.error('Failed to send return approval email:', error);
      // Don't fail the entire operation if email fails
    }
    
    return savedOrder;
  }

  /**
   * Confirm item received and process refund (Admin only)
   * This restocks inventory and processes the refund
   */
  async confirmItemReceived(orderId: string, itemIds?: string[]): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'user', 'vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.RETURN_APPROVED) {
      throw new BadRequestException('Return must be approved first');
    }

    // Restore inventory for returned items
    const itemsToReturn = itemIds && itemIds.length > 0 
      ? order.items.filter(item => itemIds.includes(item.id))
      : order.items;
    
    for (const item of itemsToReturn) {
      if (item.productId) {
        await this.productRepository.increment(
          { id: item.productId },
          'stockQuantity',
          item.quantity
        );
        
        // Get updated product stock and broadcast via WebSocket
        const product = await this.productRepository.findOne({ 
          where: { id: item.productId } 
        });
        if (product) {
          this.marketplaceGateway.emitStockUpdate(
            product.id,
            product.stockQuantity
          );
          console.log(`[confirmItemReceived] Restored ${item.quantity} units to product ${product.id}. New stock: ${product.stockQuantity}`);
        }
      }
    }

    // Update order status
    order.status = OrderStatus.RETURNED;
    order.returnedAt = new Date();
    order.adminNotes = (order.adminNotes || '') + 
      `\nItem received and verified at: ${new Date().toISOString()}\nRefund processed.`;

    // Process refund
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
      
      try {
        console.log(`[confirmItemReceived] Creating credit note for returned order ${order.orderNumber}`);
        await this.invoicesService.createCreditNote(
          order.id, 
          order.returnReason || 'Order returned by customer'
        );
      } catch (error) {
        console.error('Failed to create credit note for returned order:', error);
      }
    }

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.RETURNED, order.userId);

    const savedOrder = await this.orderRepository.save(order);
    
    // Send refund processed email
    // this.simpleEmailService.sendRefundProcessedEmail(...)
    
    return savedOrder;
  }

  /**
   * Approve an individual item return request
   */
  async approveItemReturn(returnId: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM returns WHERE id = $1`,
      [returnId]
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Return request not found');
    }

    const returnItem = result[0];

    if (returnItem.status !== 'requested') {
      throw new BadRequestException('Return request has already been processed');
    }

    // Update return status to approved
    await this.dataSource.query(
      `UPDATE returns 
       SET status = $1, approved_at = $2, updated_at = $3 
       WHERE id = $4`,
      ['approved', new Date(), new Date(), returnId]
    );

    // Emit WebSocket event to notify customer
    this.marketplaceGateway.emitOrderStatusUpdate(
      returnItem.order_id, 
      'return_item_approved', 
      returnItem.user_id
    );

    return {
      success: true,
      message: 'Item return approved. Customer can now ship the item back.',
    };
  }

  /**
   * Reject an individual item return request
   */
  async rejectItemReturn(returnId: string, reason: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM returns WHERE id = $1`,
      [returnId]
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Return request not found');
    }

    const returnItem = result[0];

    if (returnItem.status !== 'requested') {
      throw new BadRequestException('Return request has already been processed');
    }

    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    // Update return status to rejected
    await this.dataSource.query(
      `UPDATE returns 
       SET status = $1, rejected_at = $2, rejection_reason = $3, updated_at = $4 
       WHERE id = $5`,
      ['rejected', new Date(), reason, new Date(), returnId]
    );

    // Emit WebSocket event to notify customer
    this.marketplaceGateway.emitOrderStatusUpdate(
      returnItem.order_id, 
      'return_item_rejected', 
      returnItem.user_id
    );

    return {
      success: true,
      message: 'Item return request rejected.',
    };
  }

  /**
   * Confirm individual item return received and process refund
   */
  async confirmItemReturnReceived(returnId: string, refundNow: boolean = true) {
    const result = await this.dataSource.query(
      `SELECT r.*, oi.product_id, oi.variant_id, oi.quantity as item_quantity 
       FROM returns r
       LEFT JOIN order_items oi ON r.order_item_id = oi.id
       WHERE r.id = $1`,
      [returnId]
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Return request not found');
    }

    const returnItem = result[0];

    if (returnItem.status !== 'approved') {
      throw new BadRequestException('Return must be approved before confirming receipt');
    }

    // Restore inventory for the returned items (only the quantity being returned, not all items)
    if (returnItem.quantity > 0) {
      // Check if this is a variant or a simple product
      if (returnItem.variant_id) {
        // Update variant stock
        await this.dataSource.query(
          `UPDATE product_variants 
           SET stock_quantity = COALESCE(stock_quantity, 0) + $1 
           WHERE id = $2`,
          [returnItem.quantity, returnItem.variant_id]
        );
        
        // Get updated variant stock and broadcast via WebSocket
        const variantResult = await this.dataSource.query(
          `SELECT pv.*, p.id as product_id 
           FROM product_variants pv
           JOIN products p ON pv.product_id = p.id
           WHERE pv.id = $1`,
          [returnItem.variant_id]
        );
        if (variantResult && variantResult.length > 0) {
          const variant = variantResult[0];
          this.marketplaceGateway.emitStockUpdate(
            variant.product_id,
            variant.stock_quantity
          );
          console.log(`[confirmItemReturnReceived] Restored ${returnItem.quantity} units to variant ${returnItem.variant_id}. New stock: ${variant.stock_quantity}`);
        }
      } else if (returnItem.product_id) {
        // Update product stock
        await this.productRepository.increment(
          { id: returnItem.product_id },
          'stockQuantity',
          returnItem.quantity
        );
        
        // Get updated product stock and broadcast via WebSocket
        const product = await this.productRepository.findOne({ 
          where: { id: returnItem.product_id } 
        });
        if (product) {
          this.marketplaceGateway.emitStockUpdate(
            product.id,
            product.stockQuantity
          );
          console.log(`[confirmItemReturnReceived] Restored ${returnItem.quantity} units to product ${product.id}. New stock: ${product.stockQuantity}`);
        }
      }
    }

    // Update return status
    const newStatus = refundNow ? 'refunded' : 'received';
    const updateFields: any = {
      status: newStatus,
      received_at: new Date(),
      updated_at: new Date(),
    };

    if (refundNow) {
      updateFields.refunded_at = new Date();
    }

    await this.dataSource.query(
      `UPDATE returns 
       SET status = $1, received_at = $2, refunded_at = $3, updated_at = $4 
       WHERE id = $5`,
      [newStatus, updateFields.received_at, updateFields.refunded_at || null, updateFields.updated_at, returnId]
    );

    if (refundNow) {
      // Create partial credit note for the specific returned items
      try {
        console.log(`[confirmItemReturnReceived] Creating partial credit note for return ${returnItem.return_number}`);
        
        // Get order to calculate commission
        const order = await this.orderRepository.findOne({
          where: { id: returnItem.order_id },
          relations: ['vendor'],
        });
        
        const commissionRate = order?.commissionRate || order?.vendor?.commissionRate || 10;
        const returnedAmount = Number(returnItem.refund_amount) || 0;
        const returnedTax = Number(returnItem.refund_tax) || 0;
        const returnedCommission = (returnedAmount + returnedTax) * (commissionRate / 100);
        
        await this.invoicesService.createPartialCreditNote(
          returnItem.order_id,
          returnedAmount,
          returnedTax,
          returnedCommission,
          `Item return: ${returnItem.product_name} (Qty: ${returnItem.quantity}) - ${returnItem.reason}`
        );
        console.log(`[confirmItemReturnReceived] Partial credit note created for returned items`);
      } catch (error) {
        console.error('Failed to create partial credit note for item return:', error);
        // Don't fail the entire operation if credit note fails
      }

      // TODO: Process actual refund through payment gateway
      console.log(`[confirmItemReturnReceived] Processing refund of $${returnItem.refund_total} for return ${returnItem.return_number}`);
    }

    // Emit WebSocket event to notify customer
    this.marketplaceGateway.emitOrderStatusUpdate(
      returnItem.order_id, 
      refundNow ? 'return_item_refunded' : 'return_item_received', 
      returnItem.user_id
    );

    return {
      success: true,
      message: refundNow ? 'Item return received and refund processed.' : 'Item return received.',
    };
  }

  /**
   * Reject a return request (Admin only)
   */
  async rejectReturn(orderId: string, reason: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'user', 'vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.RETURN_REQUESTED) {
      throw new BadRequestException('Order does not have a pending return request');
    }

    // Revert to delivered status
    order.status = OrderStatus.DELIVERED;
    order.returnRejectedAt = new Date();
    order.returnRejectionReason = reason;
    order.adminNotes = (order.adminNotes || '') + 
      `\nReturn rejected at: ${new Date().toISOString()}\nReason: ${reason}`;

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.DELIVERED, order.userId);

    const savedOrder = await this.orderRepository.save(order);
    
    // Send return rejected email
    // this.simpleEmailService.sendOrderReturnRejectedEmail(...)
    
    return savedOrder;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
  }

  /**
   * Get user's wallet balance
   */
  async getWalletBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      select: ['walletBalance'],
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return Number(user.walletBalance) || 0;
  }

  /**
   * Download invoice for a customer's order
   * Only shows customer invoice (not vendor invoice)
   */
  async downloadOrderInvoice(orderId: string, userId: string, res: Response) {
    // First try to find order belonging to user (for customers)
    let order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['invoices', 'user'],
    });

    // If not found, check if user is admin and allow access to any order
    if (!order) {
      const user = await this.dataSource.getRepository('User').findOne({ 
        where: { id: userId } 
      });
      
      if (user && (user.role === 'super_admin' || user.role === 'admin')) {
        // Admin can access any order
        order = await this.orderRepository.findOne({
          where: { id: orderId },
          relations: ['invoices', 'user'],
        });
      }
    }

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Find customer invoice
    let customerInvoice = order.invoices?.find(inv => inv.type === 'customer');

    // If invoice doesn't exist but order is paid, generate it now
    if (!customerInvoice && order.paymentStatus === PaymentStatus.PAID) {
      console.log(`Invoice not found for paid order ${order.orderNumber}. Generating now...`);
      try {
        const createdInvoice = await this.invoicesService.createFromOrder({
          orderId: order.id,
          type: 'customer' as any,
          notes: 'Thank you for your purchase!',
        });
        customerInvoice = createdInvoice as any;
        console.log(`Invoice generated for order ${order.orderNumber}`);
      } catch (error) {
        console.error(`Failed to generate invoice for order ${order.orderNumber}:`, error);
        throw new NotFoundException('Failed to generate invoice. Please contact support.');
      }
    }

    if (!customerInvoice) {
      throw new NotFoundException('Invoice not available. Invoice is generated after payment completion.');
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

  async getReturnDetails(orderId: string) {
    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['items', 'items.product', 'user', 'vendor'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Only show return details for return_approved or returned status
      if (order.status !== OrderStatus.RETURN_APPROVED && order.status !== OrderStatus.RETURNED) {
        return null;
      }

      if (!order.vendor) {
        throw new Error('Order vendor not found');
      }

      // Get vendor's address for return shipping
      const vendor = order.vendor;
      const returnAddress = {
        name: vendor.businessName || vendor.storeName,
        addressLine1: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        postalCode: vendor.postalCode || vendor.pincode || '',
        country: vendor.country || 'India',
        phone: vendor.contactPhone || '',
      };

      // Generate comprehensive QR code data for shipping carriers (Amazon-style)
      const QRCode = require('qrcode');
    
    // Create a return authorization number
    const returnAuthNumber = `RMA-${order.orderNumber}-${Date.now().toString().slice(-6)}`;
    
    // Comprehensive QR data for carrier scanning
    const qrData = JSON.stringify({
      rma: returnAuthNumber,
      order: order.orderNumber,
      returnTo: {
        name: returnAddress.name,
        address: returnAddress.addressLine1,
        city: returnAddress.city,
        state: returnAddress.state,
        zip: returnAddress.postalCode,
        country: returnAddress.country,
        phone: returnAddress.phone,
      },
      shipmentType: 'RETURN',
      service: 'GROUND',
      timestamp: new Date().toISOString(),
      trackingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/orders/return/${returnAuthNumber}`
    });
    
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, { 
      width: 300, 
      margin: 2,
      errorCorrectionLevel: 'H' // High error correction for better scanning
    });

    return {
      orderNumber: order.orderNumber,
      returnAuthNumber,
      returnReason: order.returnReason,
      qrCodeDataUrl,
      returnAddress,
      instructions: [
        'No Printer Needed: Show this QR code at any UPS, FedEx, or postal location',
        'The carrier will scan the QR code to generate your shipping label',
        'Pack the item securely in its original packaging',
        'Hand over the package - shipping is prepaid',
        'Keep your receipt for tracking'
      ]
    };
    } catch (error) {
      console.error(`Error generating return details for order ${orderId}:`, error);
      throw error;
    }
  }
}
