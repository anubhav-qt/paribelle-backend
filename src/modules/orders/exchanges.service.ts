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

    // Money that will be credited once inspection passes — 0 for a
    // same-price swap, computed below for the other two routes. Written
    // explicitly (not left to the column default) because these columns are
    // NOT NULL with no DEFAULT on databases where the returns table predates
    // this code — see the comment on Return.refundAmount.
    let creditAmount = 0;
    let exchangeVariant: ProductVariant | null = null;

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

      const priceDiff = (Number(exchangeVariant.price) - Number(item.price)) * quantity;
      if (priceDiff > 0) {
        throw new BadRequestException(
          'The requested replacement costs more than the original item. ' +
          'Choose a replacement of equal or lower price, or request store credit instead.',
        );
      }
      // Route 1 (same product) or route 2 (different product, same or lower
      // price) — both land here; the only difference is whether a credit is
      // owed for the gap.
      creditAmount = -priceDiff;
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

  /**
   * A COD order was dispatched, the customer refused it at the door, and the
   * goods came back — but the customer asked for a different item rather
   * than a plain credit or nothing. Unlike `request()`, the order was never
   * delivered or paid, so none of the post-delivery checks apply, and the
   * goods are already back in the store's hands: the row starts at RECEIVED,
   * awaiting the same inspection admin uses for a customer-initiated
   * exchange, rather than waiting on a customer shipment that already
   * happened (they simply refused the courier).
   */
  async initiateForRefusedCod(
    orderId: string,
    orderItemId: string,
    adminUserId: string,
    quantity: number,
    exchangeVariantId: string,
    reason: string,
  ): Promise<Return> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    const item = order.items.find((i) => i.id === orderItemId);
    if (!item) throw new NotFoundException('Order item not found on this order');

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) {
      throw new BadRequestException(
        `Quantity must be between 1 and ${item.quantity} (the quantity originally ordered).`,
      );
    }

    const exchangeVariant = await this.productVariantsRepository.findOne({
      where: { id: exchangeVariantId },
    });
    if (!exchangeVariant) throw new NotFoundException('Requested variant not found');
    if (!exchangeVariant.isActive) {
      throw new BadRequestException('The requested variant is not currently available.');
    }

    const priceDiff = (Number(exchangeVariant.price) - Number(item.price)) * quantity;
    if (priceDiff > 0) {
      throw new BadRequestException(
        'The requested replacement costs more than the original item. ' +
        'Choose a replacement of equal or lower price, or issue store credit instead.',
      );
    }
    const creditAmount = -priceDiff;

    const returnRow = this.returnsRepository.create({
      returnNumber: this.generateReturnNumber(),
      orderId: order.id,
      orderItemId: item.id,
      userId: order.userId,
      vendorId: order.vendorId,
      requestType: ReturnRequestType.EXCHANGE,
      quantity,
      reason,
      status: ReturnStatus.RECEIVED,
      productName: item.productName,
      productSku: item.productSku,
      variantOptions: item.variantDetails || null,
      originalPrice: item.price,
      originalQuantity: item.quantity,
      refundAmount: creditAmount,
      refundTax: 0,
      refundTotal: creditAmount,
      exchangeVariantId: exchangeVariant.id,
      customerNotes: null,
      adminNotes: `Initiated by admin — COD delivery refused, customer requested exchange. ${reason}`,
      requestedAt: new Date(),
      receivedAt: new Date(),
    });

    const saved = await this.returnsRepository.save(returnRow);

    this.notificationsService
      .notifyUser(order.userId, NotificationType.EXCHANGE_REQUESTED, 'Exchange started for your refused delivery', {
        link: '/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify customer of admin-initiated exchange:', err));

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
    // IN_TRANSIT is the normal customer-shipped-it-back path. RECEIVED with
    // no inspection result yet is the admin-initiated COD-refusal path (see
    // `initiateForRefusedCod`) — the goods never left the store, so there is
    // no shipping leg to wait through.
    const awaitingInspection =
      row.status === ReturnStatus.IN_TRANSIT ||
      (row.status === ReturnStatus.RECEIVED && !row.inspectionResult);
    if (!awaitingInspection) {
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

    const hasReplacement = !!row.exchangeVariantId;
    const nextStatus = hasReplacement ? ReturnStatus.RECEIVED : ReturnStatus.COMPLETED;

    // Passed: move the stock in one transaction so a shortfall on the
    // replacement variant leaves neither side changed. Route 3 (no
    // replacement requested) only restocks the returned item.
    await this.dataSource.transaction(async (manager) => {
      if (hasReplacement) {
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
      if (!hasReplacement) row.completedAt = new Date();
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

    // A credit is owed whenever the replacement (if any) costs less than the
    // original, or there was no replacement at all — see `request()`.
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
        hasReplacement ? "We've received your item" : 'Your exchange is complete',
        {
          body: hasReplacement
            ? 'Your replacement will ship shortly.'
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

  async shipReplacement(returnId: string, trackingNumber?: string): Promise<Return> {
    const row = await this.findOrThrow(returnId);
    if (row.status !== ReturnStatus.RECEIVED || row.inspectionResult !== InspectionResult.PASSED) {
      throw new BadRequestException(
        'The replacement can only be shipped after the returned item has passed inspection.',
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

  /** Every exchange request on an order, newest first — for the customer's order detail view and the admin decision panel. */
  async findByOrder(orderId: string): Promise<Return[]> {
    return this.returnsRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllForAdmin(): Promise<Return[]> {
    return this.returnsRepository.find({
      relations: ['order', 'user'],
      order: { createdAt: 'DESC' },
    });
  }
}
