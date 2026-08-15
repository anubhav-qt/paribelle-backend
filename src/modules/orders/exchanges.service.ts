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

  /**
   * The flat fee for couriering a replacement back out, from the
   * `exchange_courier_charge` setting. 0 (the default) switches the charge
   * off entirely — no fee is quoted, and the customer is never asked how
   * they'd like to pay one.
   */
  private async getCourierCharge(): Promise<number> {
    const raw = await this.settingsService.getSetting('exchange_courier_charge');
    const amount = Number(raw);
    return Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 0;
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
   *  - `exchangeVariantId` names a variant of a *different* product → the
   *    original item's full value is credited to the customer's wallet once
   *    the returned item passes inspection, and the admin then places the
   *    replacement order against that credit.
   *  - No `exchangeVariantId` at all → the customer wants nothing back; the
   *    full item value is credited to their wallet once inspection passes.
   *
   * A replacement may cost the same or less, never more: exchanging *up* is
   * not offered (see the price check below). Anything the replacement doesn't
   * consume simply stays in the customer's store credit.
   *
   * The one thing the customer may owe is the courier charge for shipping the
   * replacement out — a flat, configurable fee (`exchange_courier_charge`)
   * they choose how to pay, independently of how the original order was paid.
   *
   * Enforces every rule in the "Rules to enforce" table of Task 8: delivered,
   * paid, within the configured window, quantity no more than what was
   * ordered — plus a mandatory `videoUrl`, since the video is the only
   * evidence of the item's condition the admin has when deciding.
   */
  async request(
    orderId: string,
    orderItemId: string,
    userId: string,
    quantity: number,
    reason: string,
    exchangeVariantId: string | null | undefined,
    videoUrl: string,
    customerNotes?: string,
    images?: string[],
    courierChargePaymentMethod?: 'wallet' | 'cod' | 'online' | null,
  ): Promise<Return> {
    if (typeof videoUrl !== 'string' || !videoUrl.trim()) {
      throw new BadRequestException(
        'A video of the item is required to request an exchange. ' +
        'Record a short clip showing the problem and attach it to your request.',
      );
    }

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

    const existingForItem = await this.returnsRepository.find({
      where: { orderItemId },
    });

    // One shot per item once it has physically come back to us. An exchange
    // that was approved on the strength of the customer's video and then
    // rejected *after* the item was returned — it failed inspection, or the
    // admin rejected it once they had it in hand — closes this item out for
    // good: we have already looked at the actual goods and said no, and
    // there is nothing a second request could add. A request rejected before
    // approval (video alone, item never shipped back) does not count — that
    // one never got as far as us seeing anything.
    const settledAgainstItem = existingForItem.find(
      (r) => r.status === ReturnStatus.REJECTED && !!r.approvedAt,
    );
    if (settledAgainstItem) {
      throw new BadRequestException(
        'This item is no longer eligible for exchange. A previous exchange request for it was ' +
        'approved and then rejected after we received and checked the item' +
        (settledAgainstItem.rejectionReason ? ` — "${settledAgainstItem.rejectionReason}"` : '') +
        '. Please contact support if you think this is a mistake.',
      );
    }

    // A partial exchange on the same item across multiple requests must not
    // exceed what was ordered — sum whatever is already outstanding for it.
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

      // Exchanging *up* is not offered. A replacement must cost the same or
      // less than what it replaces — the store does not take further payment
      // for the goods themselves, so there is no route by which a pricier
      // item could be paid for. Compared per unit, since that is the pairing
      // that actually happens regardless of how the quantity is split.
      const replacementUnitPrice = Number(exchangeVariant.price);
      const originalUnitPrice = Number(item.price);
      if (replacementUnitPrice > originalUnitPrice) {
        throw new BadRequestException(
          `You can only exchange for something of the same value or less. ` +
          `That item is ₹${replacementUnitPrice.toFixed(2)} against the ₹${originalUnitPrice.toFixed(2)} you paid — ` +
          `₹${(replacementUnitPrice - originalUnitPrice).toFixed(2)} more. Pick something at ₹${originalUnitPrice.toFixed(2)} or under.`,
        );
      }

      isSameProductSwap = exchangeVariant.productId === item.productId;

      if (!isSameProductSwap) {
        // Route 2: different product. The original item's value is credited
        // in full; a cheaper replacement simply leaves the remainder sitting
        // in the customer's store credit.
        creditAmount = originalUnitPrice * quantity;
      }
      // Route 1 (same product, different variant): creditAmount stays 0 —
      // no money moves for a like-for-like swap.
    }

    // The courier charge, quoted now and frozen on the row. Only when a
    // parcel is actually going back out — a credit-only exchange (route 3)
    // ships nothing, so it is never charged for shipping.
    const configuredCourierCharge = await this.getCourierCharge();
    const courierCharge = exchangeVariantId ? configuredCourierCharge : 0;
    let resolvedCourierMethod: 'wallet' | 'cod' | 'online' | null = null;
    if (courierCharge > 0) {
      const allowedMethods: string[] = isSameProductSwap
        ? ['wallet', 'cod']
        : ['wallet', 'cod', 'online'];
      if (!allowedMethods.includes(String(courierChargePaymentMethod))) {
        throw new BadRequestException(
          `Shipping the replacement out costs ₹${courierCharge.toFixed(2)}. ` +
          (isSameProductSwap
            ? 'Choose how you want to pay it: store credit or Cash on Delivery.'
            : 'Choose how you want to pay it: store credit, Cash on Delivery, or online.'),
        );
      }
      // Online payment needs an order to sit on, and only a
      // different-product exchange creates one (`createReplacementOrder`).
      // A same-product swap ships off the original order, which is long
      // since paid — there is nothing there to charge against.
      if (courierChargePaymentMethod === 'online' && isSameProductSwap) {
        throw new BadRequestException(
          'Paying online isn\'t available for a straight size or colour swap — ' +
          'choose store credit or Cash on Delivery.',
        );
      }
      if (courierChargePaymentMethod === 'wallet') {
        const currentBalance = await this.ordersService.getWalletBalance(userId);
        if (currentBalance < courierCharge) {
          throw new BadRequestException(
            `Your wallet balance (₹${currentBalance.toFixed(2)}) isn't enough to cover the ` +
            `₹${courierCharge.toFixed(2)} courier charge. Choose Cash on Delivery instead, or top up your wallet first.`,
          );
        }
      }
      // Narrowed by the `allowedMethods` check above — anything else has
      // already thrown by this point.
      resolvedCourierMethod = courierChargePaymentMethod as 'wallet' | 'cod' | 'online';
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
      topUpAmount: 0,
      topUpPaymentMethod: null,
      courierCharge,
      courierChargePaymentMethod: resolvedCourierMethod,
      exchangeVariantId: exchangeVariant?.id || null,
      videoUrl: videoUrl.trim(),
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
        body: `${item.productName} — ${reason}. Review the customer's video and approve or reject.`,
        // `view=exchanges` opens the exchange panel for this order rather
        // than the generic order details — that panel is where the
        // approve/reject buttons this notification is asking for live.
        link: '/admin/orders?view=exchanges', orderId: order.id,
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
        body: `${row.productName}. Record the inspection result once it arrives.`,
        link: '/admin/orders?view=exchanges', orderId: row.orderId,
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

  /**
   * Takes the courier charge off the customer's wallet, if that is how they
   * chose to pay it. Called at the moment the replacement actually ships and
   * not a step earlier — an exchange that never gets that far (rejected, or
   * failed inspection) must not cost the customer anything. Idempotent via
   * `courierChargePaidAt`, and non-fatal: a wallet that has since been spent
   * down shouldn't block the parcel going out, it leaves the fee to be
   * collected on delivery instead.
   *
   * A 'cod' charge isn't handled here at all — it rides along on the
   * replacement order's COD balance (route 2) or is collected at the door by
   * the courier (route 1).
   */
  private async debitCourierChargeFromWallet(row: Return): Promise<void> {
    const amount = Number(row.courierCharge) || 0;
    if (amount <= 0 || row.courierChargePaymentMethod !== 'wallet' || row.courierChargePaidAt) return;
    try {
      await this.walletService.debit(row.userId, amount, WalletLedgerType.EXCHANGE_COURIER_CHARGE, {
        exchangeId: row.id,
        orderId: row.orderId,
        description: `Exchange ${row.returnNumber} courier charge`,
      });
      row.courierChargePaidAt = new Date();
      await this.returnsRepository.update(row.id, { courierChargePaidAt: row.courierChargePaidAt });
    } catch (err) {
      console.error(`Failed to debit courier charge for exchange ${row.returnNumber}:`, err);
      row.adminNotes =
        (row.adminNotes || '') +
        `\nCourier charge of ₹${amount.toFixed(2)} could not be taken from the wallet — collect it on delivery.`;
      await this.returnsRepository.update(row.id, { adminNotes: row.adminNotes });
    }
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
    await this.debitCourierChargeFromWallet(saved);

    const courierNote =
      Number(saved.courierCharge) > 0 && saved.courierChargePaymentMethod === 'cod'
        ? `₹${Number(saved.courierCharge).toFixed(2)} courier charge to pay on delivery.`
        : Number(saved.courierCharge) > 0
          ? `₹${Number(saved.courierCharge).toFixed(2)} courier charge taken from your store credit.`
          : '';

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_REPLACEMENT_SHIPPED, 'Your replacement is on its way', {
        body: [trackingNumber ? `Tracking: ${trackingNumber}` : '', courierNote].filter(Boolean).join(' ') || undefined,
        link: '/orders', orderId: row.orderId,
      })
      .catch((err) => console.error('Failed to notify customer of replacement shipment:', err));

    return saved;
  }

  /**
   * Route 2 — the returned item was credited in full at inspection; this
   * places the actual replacement order for the (different) product the
   * customer asked for and links the two together. The goods themselves are
   * always paid for out of that credit (`useWalletBalance: true`) and can
   * never cost more than it, since a pricier replacement is refused at
   * request time.
   *
   * The courier charge is the one part the customer had a say in, and this
   * honours it rather than reusing the original order's terms. 'wallet' lets
   * the drawdown cover the whole order, fee included. 'cod' and 'online' cap
   * the wallet at the value of the goods, so the fee alone is left owing on
   * the new order — collected at the door for 'cod', or left as a Razorpay
   * balance the customer settles from their orders page for 'online' (the
   * order's `total` is that outstanding figure, which is exactly what
   * `PaymentsService.createRazorpayOrder` charges).
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
    // The configured courier charge as quoted when the request was made —
    // see `Return.courierCharge`, deliberately frozen there rather than
    // re-read from settings, which may have changed since.
    const shippingCost = Number(row.courierCharge) || 0;
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
      // The goods always come out of the credit issued at inspection; the
      // only thing that can still be owing is the courier charge, so the
      // order's payment method is really the customer's answer to "how are
      // you paying that?" — 'online' leaves it as a Razorpay balance they
      // settle from their orders page, anything else as COD at the door.
      paymentMethod: row.courierChargePaymentMethod === 'online' ? 'razorpay' : 'cod',
      useWalletBalance: true,
      // Capping the drawdown at the value of the goods is what leaves
      // exactly the courier fee behind to be collected. Not applied for a
      // 'wallet' charge, where the whole point is that the credit covers it.
      maxWalletAmount:
        shippingCost > 0 && row.courierChargePaymentMethod !== 'wallet'
          ? Number(itemTotal.toFixed(2))
          : undefined,
    });
    const createdOrder = Array.isArray(order) ? order[0] : order;

    row.completedOrderId = createdOrder.id;
    row.status = ReturnStatus.COMPLETED;
    row.completedAt = new Date();
    // The wallet already covered the fee inside the order above, so mark it
    // settled rather than debiting it a second time.
    if (shippingCost > 0 && row.courierChargePaymentMethod === 'wallet') {
      row.courierChargePaidAt = new Date();
    }
    row.adminNotes = (row.adminNotes || '') + `\nReplacement order ${createdOrder.orderNumber} created at ${new Date().toISOString()}`;
    const saved = await this.returnsRepository.save(row);

    this.notificationsService
      .notifyUser(row.userId, NotificationType.EXCHANGE_REPLACEMENT_SHIPPED, 'Your replacement order is ready', {
        body:
          `Order #${createdOrder.orderNumber} has been placed for your replacement.` +
          (shippingCost <= 0
            ? ''
            : row.courierChargePaymentMethod === 'cod'
              ? ` ₹${shippingCost.toFixed(2)} courier charge to pay on delivery.`
              : row.courierChargePaymentMethod === 'online'
                ? ` ₹${shippingCost.toFixed(2)} courier charge is due — pay it from your orders page.`
                : ` ₹${shippingCost.toFixed(2)} courier charge was taken from your store credit.`),
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
