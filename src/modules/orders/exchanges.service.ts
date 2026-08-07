import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Return, ReturnStatus, ReturnRequestType, InspectionResult } from './return.entity';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { SettingsService } from '../admin/settings.service';
import { MarketplaceGateway } from '../stock/stock.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { WalletService } from '../wallet/wallet.service';
import { WalletLedgerType } from '../wallet/wallet-ledger.entity';
import { OrdersService } from './orders.service';

/**
 * The exchange sub-machine — see Task 8 in the implementation plan for the
 * full diagram. This is the only customer-initiated path left in the store:
 * there is no cancellation-for-refund and no plain return. Every method here
 * that an admin calls is `@AdminOnly()` at the controller — see
 * ExchangesController.
 */
@Injectable()
export class ExchangesService {
  constructor(
    @InjectRepository(Return)
    private returnsRepository: Repository<Return>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantsRepository: Repository<ProductVariant>,
    private settingsService: SettingsService,
    private marketplaceGateway: MarketplaceGateway,
    private notificationsService: NotificationsService,
    private walletService: WalletService,
    private ordersService: OrdersService,
    private dataSource: DataSource,
  ) {}

  private async getExchangeWindowDays(): Promise<number> {
    const raw = await this.settingsService.getSetting('exchange_window_days');
    const days = Number(raw);
    return Number.isFinite(days) && days > 0 ? days : 7;
  }

  private generateReturnNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `EXC-${date}-${rand}`;
  }

  /**
   * A customer requests an exchange on a delivered, paid order item. Three
   * routes, chosen by what's passed rather than by a separate flag:
   *
   *  - `exchangeVariantId` names a variant of the *same* product, same price
   *    → a straight swap, no money moves (the original behaviour).
   *  - `exchangeVariantId` names a variant of a *different* product that
   *    costs no more than the original → allowed; the difference is credited
   *    to the customer's wallet once the returned item passes inspection. A
   *    replacement that costs *more* is rejected here — the store does not
   *    yet collect a top-up payment for the difference; the customer should
   *    request full credit instead and place a new order.
   *  - No `exchangeVariantId` at all → the customer wants nothing back; the
   *    full item value is credited to their wallet once inspection passes.
   *
   * Enforces every rule in the "Rules to enforce" table of Task 8: delivered,
   * paid, within the configured window, quantity no more than what was
   * ordered.
   */
  async request(
    orderId: string,
    orderItemId: string,
    userId: string,
    quantity: number,
    reason: string,
    exchangeVariantId: string | null | undefined,
    customerNotes?: string,
    images?: string[],
  ): Promise<Return> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.product', 'vendor'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== OrderStatus.DELIVERED || order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Exchanges can only be requested for delivered, paid orders.',
      );
    }

    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new NotFoundException('Order item not found on this order');

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
      throw new BadRequestException(
        `Quantity must be between 1 and ${item.quantity} (the quantity originally ordered).`,
      );
    }

    // A partial exchange on the same item across multiple requests must not
    // exceed what was ordered — sum whatever is already outstanding for it.
    const existingForItem = await this.returnsRepository.find({
      where: { orderItemId },
    });
    const alreadyRequested = existingForItem
      .filter((r) => r.status !== ReturnStatus.REJECTED)
      .reduce((sum, r) => sum + r.quantity, 0);
    if (alreadyRequested + quantity > item.quantity) {
      throw new BadRequestException(
        `Only ${item.quantity - alreadyRequested} unit(s) of this item remain eligible for exchange.`,
      );
    }

    if (!order.deliveredAt) {
      throw new BadRequestException('Order has no recorded delivery date.');
    }
    const windowDays = await this.getExchangeWindowDays();
    const daysSinceDelivery = Math.floor(
      (Date.now() - order.deliveredAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceDelivery > windowDays) {
      throw new BadRequestException(
        `The exchange window has expired (${windowDays} days from delivery). ` +
        `This order was delivered ${daysSinceDelivery} days ago.`,
      );
    }

    // Money that will be credited once inspection passes. A same-product
    // swap (route 1) moves no money at all — the customer just gets a
    // different size/colour of what they already paid for. Both other
    // routes credit the *full* original value, not just the price gap: a
    // different-product exchange (route 2) works by the admin then placing
    // a brand new order for the replacement, paid for out of that credit
    // (see `createReplacementOrder`) — crediting only the difference would
    // leave nothing to actually pay for the new item with. Whatever the
    // replacement doesn't consume simply remains as credit, which is the
    // correct outcome either way. Written explicitly (not left to the
    // column default) because these columns are NOT NULL with no DEFAULT on
    // databases where the returns table predates this code — see the
    // comment on Return.refundAmount.
    let creditAmount = 0;
    let exchangeVariant: ProductVariant | null = null;
    let isSameProductSwap = false;

    if (!exchangeVariantId) {
      // Route 3: customer wants nothing back, full value credited.
      creditAmount = Number(item.price) * quantity;
    } else {
      exchangeVariant = await this.productVariantsRepository.findOne({
        where: { id: exchangeVariantId },
      });
      if (!exchangeVariant) throw new NotFoundException('Requested variant not found');
      if (exchangeVariant.id === item.variantId) {
        throw new BadRequestException('That is the variant already on the order.');
      }
      if (!exchangeVariant.isActive) {
        throw new BadRequestException('The requested variant is not currently available.');
      }

      isSameProductSwap = exchangeVariant.productId === item.productId;

      if (!isSameProductSwap) {
        // Route 2: different product. The admin-created replacement order
        // will need the wallet to cover its full price, so the replacement
        // can't cost more than what's being credited (the original value).
        const newItemValue = Number(exchangeVariant.price) * quantity;
        const originalValue = Number(item.price) * quantity;
        if (newItemValue > originalValue) {
          throw new BadRequestException(
            'The requested replacement costs more than the original item. ' +
            'Choose a replacement of equal or lower price, or request store credit instead.',
          );
        }
        creditAmount = originalValue;
      }
      // Route 1 (same product, different variant): creditAmount stays 0 —
      // no money moves for a like-for-like swap.
    }

    const returnRow = this.returnsRepository.create({
      returnNumber: this.generateReturnNumber(),
      orderId: order.id,
      orderItemId: item.id,
      userId,
      vendorId: order.vendorId,
      requestType: ReturnRequestType.EXCHANGE,
      quantity,
      reason,
      status: ReturnStatus.REQUESTED,
      productName: item.productName,
      productSku: item.productSku,
      variantOptions: item.variantDetails || null,
      originalPrice: item.price,
      originalQuantity: item.quantity,
      refundAmount: creditAmount,
      refundTax: 0,
      refundTotal: creditAmount,
      exchangeVariantId: exchangeVariant?.id || null,
      images: images || null,
      customerNotes: customerNotes || null,
      requestedAt: new Date(),
    });

    const saved = await this.returnsRepository.save(returnRow);

    this.notificationsService
      .notifyUser(userId, NotificationType.EXCHANGE_REQUESTED, 'Exchange request received', {
        link: '/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify customer of exchange request:', err));
    this.notificationsService
      .notifyAdmins(NotificationType.EXCHANGE_REQUESTED, `Exchange requested on order #${order.orderNumber}`, {
        link: '/admin/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify admins of exchange request:', err));

    return saved;
  }

  private async findOrThrow(returnId: string): Promise<Return> {
    const row = await this.returnsRepository.findOne({ where: { id: returnId } });
    if (!row) throw new NotFoundException('Exchange request not found');
    return row;
  }

  async approve(returnId: string, adminUserId: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.REQUESTED) {
      throw new BadRequestException(`Cannot approve an exchange in status "${row.status}"`);
    }
    row.status = ReturnStatus.APPROVED;
    row.approvedAt = new Date();
    row.approvedBy = { id: adminUserId } as any;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_APPROVED, 'Your exchange request was approved', {
        body: 'Ship the item back to us to continue.',
        link: '/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify customer of exchange approval:', err));

    return saved;
  }

  async reject(returnId: string, adminUserId: string, reason: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (![ReturnStatus.REQUESTED, ReturnStatus.APPROVED, ReturnStatus.IN_TRANSIT].includes(row.status)) {
      throw new BadRequestException(`Cannot reject an exchange in status "${row.status}"`);
    }
    row.status = ReturnStatus.REJECTED;
    row.rejectedAt = new Date();
    row.rejectedBy = { id: adminUserId } as any;
    row.rejectionReason = reason;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_REJECTED, 'Your exchange request was rejected', {
        body: reason,
        link: '/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify customer of exchange rejection:', err));

    return saved;
  }

  /**
   * The customer reports they have shipped the item back. Ownership is
   * checked so this cannot be called for someone else's exchange.
   */
  async markInTransit(returnId: string, userId: string, trackingNumber?: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.userId !== userId) throw new ForbiddenException('Not your exchange request');
    if (row.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException(`Cannot mark in transit from status "${row.status}"`);
    }
    row.status = ReturnStatus.IN_TRANSIT;
    row.inTransitAt = new Date();
    if (trackingNumber) row.customerTrackingNumber = trackingNumber;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyAdmins(NotificationType.EXCHANGE_IN_TRANSIT, `Customer shipped back an exchange item — ${row.returnNumber}`, {
        link: '/admin/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify admins the item is in transit:', err));

    return saved;
  }

  /**
   * Admin confirms the parcel arrived and records whether the item passed
   * inspection (legitimate and unused, per the store's exchange policy).
   *
   * Stock only moves on a pass: the replacement variant is decremented and
   * the returned unit is restocked. A failed inspection moves no stock at
   * all — the item is not resold, whatever the failed-inspection setting says
   * happens to it physically (see `exchange_failed_inspection`).
   */
  async recordInspection(
    returnId: string,
    adminUserId: string,
    result: InspectionResult,
    notes?: string,
  ): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.IN_TRANSIT) {
      throw new BadRequestException(`Cannot record inspection from status "${row.status}"`);
    }

    row.receivedAt = row.receivedAt || new Date();
    row.inspectedAt = new Date();
    row.inspectionResult = result;
    row.inspectionNotes = notes || null;
    row.inspectedBy = { id: adminUserId } as any;

    if (result === InspectionResult.FAILED) {
      row.status = ReturnStatus.REJECTED;
      row.rejectedAt = new Date();
      row.rejectionReason = notes || 'Item failed exchange inspection';
      const saved = await this.returnsRepository.save(row);

      this.notificationsService
        .notifyUser(row.userId, NotificationType.EXCHANGE_INSPECTION_FAILED, 'Your returned item did not pass inspection', {
          body: row.rejectionReason,
          link: '/orders', orderId: row.orderId,
        })
        .catch((err) => console.error('Failed to notify customer of failed inspection:', err));

      return saved;
    }

    const orderItemForRoute = await this.orderItemRepository.findOne({ where: { id: row.orderItemId } });
    const requestedVariant = row.exchangeVariantId
      ? await this.productVariantsRepository.findOne({ where: { id: row.exchangeVariantId } })
      : null;
    const isSameProductSwap = !!requestedVariant && requestedVariant.productId === orderItemForRoute?.productId;
    // Route 1 (same product, different variant): a direct stock swap here,
    // no money moves, admin ships the replacement off this same row.
    // Route 2 (different product): only the returned item comes back to
    // stock — the replacement is a brand new order the admin places next
    // (see `createReplacementOrder`), so this row waits at RECEIVED rather
    // than completing here.
    // Route 3 (no replacement): nothing further to do once restocked and
    // credited — completes immediately.
    const nextStatus = row.exchangeVariantId ? ReturnStatus.RECEIVED : ReturnStatus.COMPLETED;

    await this.dataSource.transaction(async (manager) => {
      if (isSameProductSwap) {
        const exchangeVariant = await manager.findOne(ProductVariant, {
          where: { id: row.exchangeVariantId! },
        });
        if (!exchangeVariant) throw new NotFoundException('Replacement variant no longer exists');

        const reserved = await manager
          .createQueryBuilder()
          .update(ProductVariant)
          .set({ stockQuantity: () => `"stock_quantity" - ${row.quantity}` })
          .where('id = :id AND "stock_quantity" >= :quantity', {
            id: exchangeVariant.id,
            quantity: row.quantity,
          })
          .execute();
        if (!reserved.affected) {
          throw new BadRequestException(
            `Insufficient stock for the replacement variant. Available: ${exchangeVariant.stockQuantity}, needed: ${row.quantity}`,
          );
        }
        await this.rollUpProductStock(manager, exchangeVariant.productId);
      }

      const orderItem = await manager.findOne(OrderItem, { where: { id: row.orderItemId } });
      if (orderItem?.variantId) {
        await manager.increment(ProductVariant, { id: orderItem.variantId }, 'stockQuantity', row.quantity);
        await this.rollUpProductStock(manager, orderItem.productId);
      }

      row.status = nextStatus;
      if (nextStatus === ReturnStatus.COMPLETED) row.completedAt = new Date();
      await manager.save(Return, row);
    });

    if (row.exchangeVariantId) {
      const exchangeVariant = await this.productVariantsRepository.findOne({
        where: { id: row.exchangeVariantId },
      });
      if (exchangeVariant) {
        this.marketplaceGateway.emitStockUpdate(exchangeVariant.productId, exchangeVariant.stockQuantity);
      }
    }

    // A credit is owed for routes 2 and 3 — see `request()`. Route 1 never
    // sets refundTotal above 0.
    if (Number(row.refundTotal) > 0) {
      const { balance } = await this.walletService.credit(
        row.userId,
        Number(row.refundTotal),
        WalletLedgerType.EXCHANGE_CREDIT,
        { exchangeId: row.id, orderId: row.orderId, description: `Exchange ${row.returnNumber} credit` },
      );
      console.log(`[recordInspection] Credited ₹${row.refundTotal} to user ${row.userId}. New wallet balance: ₹${balance}`);
    }

    this.notificationsService
      .notifyUser(
        row.userId,
        NotificationType.EXCHANGE_INSPECTION_PASSED,
        isSameProductSwap
          ? "We've received your item"
          : row.exchangeVariantId
            ? 'Your item was credited — pick your replacement'
            : 'Your exchange is complete',
        {
          body: isSameProductSwap
            ? 'Your replacement will ship shortly.'
            : row.exchangeVariantId
              ? `₹${Number(row.refundTotal).toFixed(2)} has been added to your store credit while we prepare your replacement order.`
              : Number(row.refundTotal) > 0
                ? `₹${Number(row.refundTotal).toFixed(2)} has been added to your store credit.`
                : undefined,
          link: '/orders', orderId: row.orderId,
        },
      )
      .catch((err) => console.error('Failed to notify customer of passed inspection:', err));

    return row;
  }

  private async rollUpProductStock(manager: any, productId: string): Promise<void> {
    const variants = await manager.find(ProductVariant, { where: { productId } });
    const total = variants.reduce((sum: number, v: ProductVariant) => sum + (v.stockQuantity || 0), 0);
    await manager.update(Product, productId, { stockQuantity: total });
  }

  /** Route 1 only — a same-product variant swap ships off this row directly. */
  async shipReplacement(returnId: string, trackingNumber?: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.RECEIVED || row.inspectionResult !== InspectionResult.PASSED) {
      throw new BadRequestException(
        'The replacement can only be shipped after the returned item has passed inspection.',
      );
    }
    const orderItem = await this.orderItemRepository.findOne({ where: { id: row.orderItemId } });
    const exchangeVariant = row.exchangeVariantId
      ? await this.productVariantsRepository.findOne({ where: { id: row.exchangeVariantId } })
      : null;
    if (exchangeVariant?.productId !== orderItem?.productId) {
      throw new BadRequestException(
        'This exchange is for a different product — use "Create Replacement Order" instead of shipping one off this row.',
      );
    }
    row.status = ReturnStatus.REPLACEMENT_SHIPPED;
    row.replacementShippedAt = new Date();
    if (trackingNumber) row.replacementTrackingNumber = trackingNumber;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_REPLACEMENT_SHIPPED, 'Your replacement is on its way', {
        body: trackingNumber ? `Tracking: ${trackingNumber}` : undefined,
        link: '/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify customer of replacement shipment:', err));

    return saved;
  }

  /**
   * Route 2 — the returned item was credited in full at inspection; this
   * places the actual replacement order for the (different) product the
   * customer asked for, paid for entirely out of that credit (the request()
   * guard ensures the replacement never costs more than what was credited),
   * and links the two together. The new order behaves exactly like a
   * prepaid order from here — paid automatically, admin only confirms and
   * dispatches it.
   */
  async createReplacementOrder(returnId: string, adminUserId: string): Promise<{ exchange: Return; order: Order }> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.RECEIVED || row.inspectionResult !== InspectionResult.PASSED) {
      throw new BadRequestException(
        'The replacement order can only be created after the returned item has passed inspection.',
      );
    }
    if (row.completedOrderId) {
      throw new BadRequestException('A replacement order has already been created for this exchange.');
    }
    if (!row.exchangeVariantId) {
      throw new BadRequestException('This exchange has no replacement product on file — use "Settle as Credit" instead.');
    }

    const originalOrder = await this.orderRepository.findOne({ where: { id: row.orderId } });
    if (!originalOrder) throw new NotFoundException('Original order not found');

    const exchangeVariant = await this.productVariantsRepository.findOne({ where: { id: row.exchangeVariantId } });
    if (!exchangeVariant) throw new NotFoundException('Replacement variant no longer exists');
    const product = await this.productRepository.findOne({ where: { id: exchangeVariant.productId } });
    if (!product) throw new NotFoundException('Replacement product no longer exists');

    if (exchangeVariant.productId === (await this.orderItemRepository.findOne({ where: { id: row.orderItemId } }))?.productId) {
      throw new BadRequestException('This exchange is for the same product — use "Ship Replacement" instead.');
    }

    // Mirror the storefront's tax-inclusive pricing (see checkout's
    // calculateTaxBreakdown): item.price already includes GST for the
    // common mrp_with_gst pricing type, so the tax shown is extracted from
    // it, not added on top.
    const itemTotal = Number(exchangeVariant.price) * row.quantity;
    const gstRate = product.gstRate != null ? Number(product.gstRate) : 18;
    const priceType = product.priceType || 'mrp_with_gst';
    let subtotal: number;
    let tax: number;
    if (priceType === 'mrp_with_gst' && gstRate > 0) {
      subtotal = itemTotal / (1 + gstRate / 100);
      tax = itemTotal - subtotal;
    } else if (priceType === 'mrp_with_gst') {
      subtotal = itemTotal;
      tax = 0;
    } else {
      subtotal = itemTotal;
      tax = itemTotal * (gstRate / 100);
    }
    const shippingCost = 0; // Replacing an already-shipped order — no fresh shipping charge.
    const totalAmount = Number((itemTotal + shippingCost).toFixed(2));

    const order = await this.ordersService.create(row.userId, {
      items: [{ productId: exchangeVariant.productId, variantId: exchangeVariant.id, quantity: row.quantity, price: exchangeVariant.price }],
      shippingAddress: {
        fullName: originalOrder.shippingName,
        email: originalOrder.shippingEmail,
        phone: originalOrder.shippingPhone,
        addressLine1: originalOrder.shippingAddress,
        city: originalOrder.shippingCity,
        state: originalOrder.shippingState,
        country: originalOrder.shippingCountry,
        postalCode: originalOrder.shippingPostalCode,
      },
      billingAddress: originalOrder.billingAddressSameAsShipping ? undefined : {
        fullName: originalOrder.billingName,
        email: originalOrder.billingEmail,
        phone: originalOrder.billingPhone,
        addressLine1: originalOrder.billingAddress,
        city: originalOrder.billingCity,
        state: originalOrder.billingState,
        country: originalOrder.billingCountry,
        postalCode: originalOrder.billingPostalCode,
      },
      subtotal: Number(subtotal.toFixed(2)),
      shippingCost,
      tax: Number(tax.toFixed(2)),
      totalAmount,
      paymentMethod: 'cod',
      useWalletBalance: true,
    });
    const createdOrder = Array.isArray(order) ? order[0] : order;

    row.completedOrderId = createdOrder.id;
    row.status = ReturnStatus.COMPLETED;
    row.completedAt = new Date();
    row.adminNotes = (row.adminNotes || '') + `\nReplacement order ${createdOrder.orderNumber} created at ${new Date().toISOString()}`;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_REPLACEMENT_SHIPPED, 'Your replacement order is ready', {
        body: `Order #${createdOrder.orderNumber} has been placed for your replacement.`,
        link: '/orders', orderId: createdOrder.id,
      })
      .catch((err) => console.error('Failed to notify customer of replacement order:', err));

    return { exchange: saved, order: createdOrder };
  }

  /**
   * Admin decides not to source a replacement after all (e.g. the requested
   * product is no longer available) — the full credit was already issued at
   * inspection, so this simply closes the exchange out rather than issuing
   * any further money.
   */
  async settleAsCredit(returnId: string, adminUserId: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.RECEIVED || row.inspectionResult !== InspectionResult.PASSED) {
      throw new BadRequestException('This exchange is not awaiting a replacement decision.');
    }
    if (row.completedOrderId) {
      throw new BadRequestException('A replacement order was already created for this exchange.');
    }

    row.status = ReturnStatus.COMPLETED;
    row.completedAt = new Date();
    row.adminNotes = (row.adminNotes || '') + `\nSettled as store credit only (no replacement order) at ${new Date().toISOString()}`;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_INSPECTION_PASSED, 'Your exchange is complete', {
        body: `₹${Number(row.refundTotal).toFixed(2)} remains in your store credit — the replacement wasn't available, but the credit is yours to use on anything.`,
        link: '/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify customer of credit settlement:', err));

    return saved;
  }

  /** Every exchange request on an order, newest first — for the customer's order detail view and the admin decision panel. */
  async findByOrder(orderId: string): Promise<Return[]> {
    return this.returnsRepository.find({
      where: { orderId },
      relations: ['orderItem', 'exchangeVariant', 'exchangeVariant.product', 'completedOrder'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForAdmin(): Promise<Return[]> {
    return this.returnsRepository.find({
      relations: ['order', 'user', 'orderItem', 'exchangeVariant', 'exchangeVariant.product', 'completedOrder'],
      order: { createdAt: 'DESC' },
    });
  }
}
