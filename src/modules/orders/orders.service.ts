import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Product, ProductStatus } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { User, UserRole } from '../users/user.entity';
import { isStoreAdmin } from '../../common/decorators/admin-only.decorator';
import { MarketplaceGateway } from '../stock/stock.gateway';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';
import { InvoiceType } from '../invoices/invoice.entity';
import { SettingsService } from '../admin/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { WalletService } from '../wallet/wallet.service';
import { WalletLedgerType } from '../wallet/wallet-ledger.entity';
import { StoreService } from '../store/store.service';
import { STORE_ID } from '../store/store.constants';
import { Response } from 'express';

/**
 * No order event sends email. Every customer- and admin-facing order,
 * payment and exchange event is delivered in-app only, through
 * NotificationsService (the bell) plus the live socket push — see
 * NotificationType for the full catalogue. Do not reintroduce
 * SimpleEmailService here; it is reserved for account plumbing that has no
 * in-app surface (email verification, password reset).
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantsRepository: Repository<ProductVariant>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private marketplaceGateway: MarketplaceGateway,
    @Inject(forwardRef(() => InvoicesService))
    private invoicesService: InvoicesService,
    @Inject(forwardRef(() => InvoicePdfService))
    private invoicePdfService: InvoicePdfService,
    private storeService: StoreService,
    private settingsService: SettingsService,
    private notificationsService: NotificationsService,
    private walletService: WalletService,
    private dataSource: DataSource,
  ) {}

  /**
   * Flat fee added to an order that is paid Cash on Delivery. Charged once per
   * order, never on prepaid orders, and not treated as taxable (store prices
   * are already GST-inclusive; this fee is not).
   */
  private readonly COD_CHARGE = 150;

  /**
   * The photo to freeze on an order line: the colour the customer actually
   * picked, resolved the same way the product page resolves its gallery. The
   * exact variant's own images first, then any sibling variant of the same
   * colour that carries images (one colour usually shares a photo set across
   * its sizes), then the product's cover.
   */
  private resolveItemPhoto(
    product: Product,
    variantId: string | null | undefined,
    attributes: Record<string, any> | null | undefined,
    variants: ProductVariant[],
  ): string | undefined {
    const cover = product.featuredImage || product.images?.[0] || undefined;
    if (!variantId) return cover;

    const own = variants.find((v) => v.id === variantId);
    if (own?.images?.length) return own.images[0];

    const attrs = attributes || own?.variantAttributes || {};
    const colourKey = Object.keys(attrs).find((k) => /^colou?r$/i.test(k.trim()));
    if (colourKey) {
      const colour = String(attrs[colourKey]).trim().toLowerCase();
      const sibling = variants.find((v) => {
        if (v.productId !== product.id || !v.images?.length) return false;
        const va = v.variantAttributes || {};
        const key = Object.keys(va).find((k) => /^colou?r$/i.test(k.trim()));
        return key != null && String(va[key]).trim().toLowerCase() === colour;
      });
      if (sibling) return sibling.images[0];
    }

    return cover;
  }

  /**
   * Places one order. Everything that decides what the customer pays — each
   * line's price, the GST inside it, shipping and the total — is worked out
   * here from the catalogue. The request only says what to buy and where to
   * send it; any price, subtotal or total in the body is ignored. Those used
   * to be trusted, so a hand-made request could buy anything for ₹1, ship
   * with negative shipping, or name a payment method that marked the order
   * paid outright.
   *
   * A shopper's checkout always ships free and pays online (or COD, while
   * that is switched on). `placedByStore` is for the orders the store places
   * itself — an exchange's replacement, a refused COD parcel's swap — which
   * may carry the frozen courier charge as shipping and leave it owing.
   */
  async create(
    userId: string,
    createOrderDto: any,
    idempotencyKey?: string,
    placedByStore?: {
      shippingCost: number;
      paymentMethod: 'razorpay' | 'cod';
      /** Store credit pays for the goods only, leaving the shipping owing. */
      walletCoversGoodsOnly?: boolean;
    },
  ) {
    const { items, shippingAddress, billingAddress, useWalletBalance } = createOrderDto || {};
    const paymentMethod = placedByStore?.paymentMethod ?? createOrderDto?.paymentMethod;
    if (paymentMethod !== 'razorpay' && paymentMethod !== 'cod') {
      throw new BadRequestException('Please pay online (UPI, card or net banking).');
    }

    // Replay protection. A double-click, an impatient refresh or a client
    // retry after a timeout all arrive as a second POST for an order that was
    // already placed; return what that attempt created instead of charging the
    // customer twice.
    const normalizedKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim().slice(0, 64) : '';
    if (normalizedKey) {
      const existing = await this.orderRepository.find({
        where: { userId, idempotencyKey: normalizedKey },
        relations: ['items'],
      });
      if (existing.length > 0) {
        return existing.length === 1 ? existing[0] : existing;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Your bag is empty.');
    }
    if (items.length > 50) {
      throw new BadRequestException('Too many lines in one order.');
    }
    const requiredAddressFields = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'postalCode'];
    if (!shippingAddress || requiredAddressFields.some((f) => !String(shippingAddress[f] ?? '').trim())) {
      throw new BadRequestException('Please complete the delivery address.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Every requested quantity must be a positive whole number. Without this a
    // crafted request with a negative quantity would *increase* stock on the
    // decrement below.
    for (const item of items) {
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        throw new BadRequestException('Each item needs a quantity between 1 and 100.');
      }
      item.quantity = quantity;
    }

    const productIds = Array.from(new Set<string>(items.map((item: any) => String(item.productId))));
    const products = await this.productRepository.find({ where: { id: In(productIds) } });
    // Compare against distinct ids: two sizes of the same kurti are two cart
    // lines but one product row.
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more items in your bag are no longer available.');
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    // The seller details printed on the invoice, frozen as they are today.
    // Read before any stock is held, so a failure here leaves nothing to undo.
    const seller = await this.storeService.sellerSnapshot();

    // Every variant of every ordered product, loaded once: for pricing, and
    // so each line can snapshot the photo of the colour that was bought
    // rather than the product's cover shot (which may show another colour).
    const orderedVariants = await this.productVariantsRepository.find({
      where: { productId: In(productIds) },
    });

    // Price every line from the catalogue.
    const lines = items.map((item: any) => {
      const product = productById.get(String(item.productId))!;
      const purchasable =
        (product.status === ProductStatus.ACTIVE || product.status === ProductStatus.OUT_OF_STOCK) &&
        !product.isParent;
      if (!purchasable) {
        throw new BadRequestException(`"${product.name}" is no longer available.`);
      }

      let variant: ProductVariant | undefined;
      if (item.variantId) {
        variant = orderedVariants.find((v) => v.id === item.variantId);
        if (!variant || variant.productId !== product.id || variant.isActive === false) {
          throw new BadRequestException(`That option of "${product.name}" is no longer available.`);
        }
      } else if (product.hasVariants) {
        throw new BadRequestException(`Please choose a size for "${product.name}".`);
      }

      const unitPrice = Number(variant ? variant.price : product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new BadRequestException(`"${product.name}" can't be ordered right now.`);
      }

      const gstRate = product.gstRate != null ? Number(product.gstRate) : 18;
      const listed = unitPrice * item.quantity;
      // Store prices are GST-inclusive ('mrp_with_gst'): the tax is inside the
      // price. A 'selling_price_without_gst' product has it added on top.
      const inclusive = (product.priceType || 'mrp_with_gst') === 'mrp_with_gst';
      const tax = inclusive ? listed - listed / (1 + gstRate / 100) : listed * (gstRate / 100);
      const payable = inclusive ? listed : listed + tax;

      return { item, product, variant, unitPrice, listed, tax, payable };
    });

    const round2 = (n: number) => Number(n.toFixed(2));
    const goodsTotal = round2(lines.reduce((s, l) => s + l.payable, 0));
    const tax = round2(lines.reduce((s, l) => s + l.tax, 0));
    const subtotal = round2(goodsTotal - tax);
    // Shipping is free. Only a store-placed order carries a courier charge.
    const shippingCost = Math.max(round2(Number(placedByStore?.shippingCost) || 0), 0);
    const totalBeforeWallet = round2(goodsTotal + shippingCost);

    let walletAmountUsed = 0;
    if (useWalletBalance && Number(user.walletBalance) > 0) {
      const spendable = placedByStore?.walletCoversGoodsOnly ? goodsTotal : totalBeforeWallet;
      walletAmountUsed = round2(Math.min(Number(user.walletBalance), spendable));
    }
    const leftToPay = round2(totalBeforeWallet - walletAmountUsed);
    const paidByWallet = leftToPay <= 0 && walletAmountUsed > 0;

    // COD handling fee, only when there is still something to collect at the
    // door after store credit.
    const codCharge = paymentMethod === 'cod' && leftToPay > 0 ? this.COD_CHARGE : 0;
    const total = Math.max(round2(leftToPay + codCharge), 0);

    // Reserve stock atomically.
    //
    // The client-side checks are advisory only — the shopper's cart may be
    // hours stale and the request can be crafted by hand. Validating and then
    // decrementing in two steps still oversells whenever two orders for the
    // last unit interleave between the two, so each reservation is a single
    // conditional UPDATE that only succeeds while the stock is actually there.
    // The whole set runs in one transaction, so a shortfall on the third line
    // gives the first two back.
    const stockUpdates: Array<{ productId: string; stockQuantity: number }> = [];

    await this.dataSource.transaction(async (manager) => {
      for (const { item, product, variant } of lines) {
        // Popularity sort reads this. Counted for every order regardless of
        // inventory tracking, and in the same transaction as the stock
        // reservation, so a rolled-back order cannot inflate it.
        await manager.increment(Product, { id: product.id }, 'salesCount', item.quantity);

        if (!product.trackInventory) continue;

        if (variant) {
          // The raw SQL fragments below must name the *column*
          // (`stock_quantity`), not the entity property (`stockQuantity`):
          // TypeORM passes raw strings straight to Postgres.
          const reserved = await manager
            .createQueryBuilder()
            .update(ProductVariant)
            .set({ stockQuantity: () => `"stock_quantity" - ${item.quantity}` })
            .where('id = :id AND "stock_quantity" >= :quantity', {
              id: variant.id,
              quantity: item.quantity,
            })
            .execute();

          if (!reserved.affected) {
            const label = Object.values(variant.variantAttributes || {}).join('/');
            throw new BadRequestException(
              `Only ${variant.stockQuantity ?? 0} left of "${product.name}"${label ? ` (${label})` : ''}.`,
            );
          }

          // Roll the new total up to the parent product
          const variants = await manager.find(ProductVariant, { where: { productId: product.id } });
          const newTotal = variants.reduce((s, v) => s + (v.stockQuantity || 0), 0);
          await manager.update(Product, product.id, { stockQuantity: newTotal });
          stockUpdates.push({ productId: product.id, stockQuantity: newTotal });
        } else {
          const reserved = await manager
            .createQueryBuilder()
            .update(Product)
            .set({ stockQuantity: () => `"stock_quantity" - ${item.quantity}` })
            .where('id = :id AND "stock_quantity" >= :quantity', {
              id: product.id,
              quantity: item.quantity,
            })
            .execute();

          if (!reserved.affected) {
            throw new BadRequestException(`Only ${product.stockQuantity ?? 0} left of "${product.name}".`);
          }

          stockUpdates.push({
            productId: product.id,
            stockQuantity: (product.stockQuantity ?? 0) - item.quantity,
          });
        }
      }
    });

    if (stockUpdates.length > 0) {
      this.marketplaceGateway.emitBulkStockUpdate(stockUpdates);
    }

    // Notify admins the moment a product crosses its low-stock threshold —
    // only on the order that crosses it, so this fires once per dip rather
    // than on every sale while stock stays low.
    for (const update of stockUpdates) {
      const product = productById.get(update.productId);
      if (!product?.lowStockThreshold) continue;
      const orderedQty = lines
        .filter((l) => l.product.id === update.productId)
        .reduce((sum, l) => sum + l.item.quantity, 0);
      const stockBefore = update.stockQuantity + orderedQty;
      if (update.stockQuantity <= product.lowStockThreshold && stockBefore > product.lowStockThreshold) {
        this.notificationsService
          .notifyAdmins(NotificationType.LOW_STOCK, `${product.name} is low on stock (${update.stockQuantity} left)`, {
            body: `Only ${update.stockQuantity} left — restock or the listing will sell out.`,
            link: `/admin/products?search=${encodeURIComponent(product.name)}`,
          })
          .catch((err) => console.error('Failed to notify admins of low stock:', err));
      }
    }

    const oneLine = (a: any) => `${a.addressLine1}${a.addressLine2 ? ', ' + a.addressLine2 : ''}`;
    const billing = billingAddress && requiredAddressFields.every((f) => String(billingAddress[f] ?? '').trim())
      ? billingAddress
      : null;

    const order = this.orderRepository.create({
      orderNumber: this.generateOrderNumber(),
      idempotencyKey: normalizedKey || null,
      userId,
      vendorId: STORE_ID,
      ...seller,
      subtotal,
      tax,
      shippingCost,
      codCharge,
      discount: walletAmountUsed,
      total,
      status: OrderStatus.PENDING,
      // Store credit covering the whole order settles it immediately; there
      // is nothing left to collect. Anything else waits for the payment.
      paymentMethod: paidByWallet ? 'wallet' : paymentMethod,
      paymentStatus: paidByWallet ? PaymentStatus.PAID : PaymentStatus.PENDING,
      shippingName: shippingAddress.fullName,
      shippingEmail: shippingAddress.email || user.email,
      shippingPhone: shippingAddress.phone,
      shippingAddress: oneLine(shippingAddress),
      shippingCity: shippingAddress.city,
      shippingState: shippingAddress.state,
      shippingCountry: shippingAddress.country || 'India',
      shippingPostalCode: shippingAddress.postalCode,
      billingAddressSameAsShipping: !billing || JSON.stringify(billing) === JSON.stringify(shippingAddress),
      billingName: (billing || shippingAddress).fullName,
      billingEmail: (billing || shippingAddress).email || user.email,
      billingPhone: (billing || shippingAddress).phone,
      billingAddress: oneLine(billing || shippingAddress),
      billingCity: (billing || shippingAddress).city,
      billingState: (billing || shippingAddress).state,
      billingCountry: (billing || shippingAddress).country || 'India',
      billingPostalCode: (billing || shippingAddress).postalCode,
    });
    const savedOrder = await this.orderRepository.save(order);

    await this.orderItemRepository.save(
      lines.map(({ item, product, variant, unitPrice, listed }) =>
        this.orderItemRepository.create({
          orderId: savedOrder.id,
          productId: product.id,
          quantity: item.quantity,
          price: unitPrice,
          subtotal: round2(listed),
          total: round2(listed),
          productName: product.name,
          productSku: product.sku || '',
          productImage: this.resolveItemPhoto(product, variant?.id, variant?.variantAttributes, orderedVariants),
          variantId: variant?.id || null,
          variantDetails: variant ? { sku: variant.sku, attributes: variant.variantAttributes } : null,
        }),
      ),
    );

    // Through the ledger, not a raw column update, so this spend shows up in
    // the customer's wallet history.
    if (walletAmountUsed > 0) {
      await this.walletService.debit(userId, walletAmountUsed, WalletLedgerType.CHECKOUT_SPEND, {
        orderId: savedOrder.id,
        description: `Applied to order #${savedOrder.orderNumber}`,
      });
    }

    const placed = await this.orderRepository.findOneOrFail({
      where: { id: savedOrder.id },
      relations: ['items', 'items.product'],
    });

    // Never lets a notification failure fail the order.
    this.notificationsService
      .notifyUser(userId, NotificationType.ORDER_PLACED, `Order #${savedOrder.orderNumber} received`, {
        body: 'Awaiting confirmation.',
        link: '/orders',
        orderId: savedOrder.id,
      })
      .catch((err) => console.error('Failed to notify customer of new order:', err));
    this.notificationsService
      .notifyAdmins(NotificationType.ORDER_PLACED, `New order #${savedOrder.orderNumber} — ₹${savedOrder.total}`, {
        link: '/admin/orders',
        orderId: savedOrder.id,
      })
      .catch((err) => console.error('Failed to notify admins of new order:', err));

    // Paid in full by store credit: the invoice is due now. Razorpay orders
    // get theirs when the payment is captured.
    if (paidByWallet) {
      try {
        const existing = await this.invoicesService.findByOrderAndType(savedOrder.id, InvoiceType.CUSTOMER);
        if (!existing) {
          await this.invoicesService.createFromOrder({
            orderId: savedOrder.id,
            type: InvoiceType.CUSTOMER,
            notes: 'Thank you for your purchase!',
          });
        }
      } catch (error) {
        console.error(`Failed to generate the invoice for order ${savedOrder.orderNumber}:`, error);
      }
    }

    return placed;
  }

  async findAll(userId: string) {
    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product', 'invoices'],
      order: { createdAt: 'DESC' },
    });
    const exchangeWindowDays = await this.getExchangeWindowDays();

    // Exchange requests (the `returns` table) on these orders' items
    const orderIds = orders.map(o => o.id);
    const returnsData: any[] = orderIds.length
      ? await this.dataSource.query(
          `SELECT r.*, oi.order_id
             FROM returns r
             JOIN order_items oi ON r.order_item_id = oi.id
            WHERE oi.order_id = ANY($1)
            ORDER BY r.created_at DESC`,
          [orderIds],
        )
      : [];

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
        trackingNumber: ret.tracking_number,
        carrier: ret.carrier,
        images: ret.images,
        videoUrl: ret.video_url,
        // The order pages colour-code each item by the state of its exchange
        // and hide the button on an item that's already been settled against
        // (see `isItemExchangeBlocked`) — all of which needs these.
        inspectionResult: ret.inspection_result,
        exchangeVariantId: ret.exchange_variant_id,
        courierCharge: ret.courier_charge != null ? parseFloat(ret.courier_charge) : 0,
        courierChargePaymentMethod: ret.courier_charge_payment_method || null,
      });
      return acc;
    }, {});

    // Transform orders to include shippingAddress as object and returns
    return orders.map(order => {
      const transformed = this.transformOrder(order, exchangeWindowDays);
      return {
        ...transformed,
        returns: returnsByOrder[order.id] || []
      };
    });
  }

  async findByUserAndStatus(userId: string, status: OrderStatus) {
    const orders = await this.orderRepository.find({
      where: { userId, status },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
    const exchangeWindowDays = await this.getExchangeWindowDays();

    return orders.map(order => this.transformOrder(order, exchangeWindowDays));
  }

  /**
   * The admin dashboard's "Orders Today" tile used to fetch `GET /orders`,
   * which for an admin returns *that admin's own* orders (`findAll(userId)`
   * below), then filtered by date client-side — so it was always counting a
   * near-empty set rather than the store's real order volume. One count query
   * over every order, not the caller's own.
   */
  async getAdminStats(): Promise<{ ordersToday: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const ordersToday = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.createdAt >= :startOfDay', { startOfDay })
      .getCount();

    return { ordersToday };
  }

  async findAllForAdmin() {
    const orders = await this.orderRepository.find({
      // productVariants lets the admin screen show the photo of the colour
      // that was bought on orders placed before that photo was snapshotted.
      relations: ['items', 'items.product', 'items.product.productVariants', 'user', 'invoices'],
      order: { createdAt: 'DESC' },
    });
    const exchangeWindowDays = await this.getExchangeWindowDays();

    // Exchange requests (the `returns` table) on these orders
    const orderIds = orders.map(o => o.id);
    const returnsData: any[] = orderIds.length
      ? await this.dataSource.query(
          `SELECT * FROM returns WHERE order_id = ANY($1) ORDER BY requested_at DESC`,
          [orderIds],
        )
      : [];

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
        trackingNumber: ret.tracking_number,
        carrier: ret.carrier,
        images: ret.images,
        videoUrl: ret.video_url,
        // The order pages colour-code each item by the state of its exchange
        // and hide the button on an item that's already been settled against
        // (see `isItemExchangeBlocked`) — all of which needs these.
        inspectionResult: ret.inspection_result,
        exchangeVariantId: ret.exchange_variant_id,
        courierCharge: ret.courier_charge != null ? parseFloat(ret.courier_charge) : 0,
        courierChargePaymentMethod: ret.courier_charge_payment_method || null,
      });
      return acc;
    }, {});

    // The reverse relationship: an order can itself BE the replacement a
    // different-product exchange produced (see ExchangesService.
    // createReplacementOrder), rather than have an exchange filed against
    // it. That's `returns.completed_order_id`, not `returns.order_id` — a
    // separate lookup keyed by the *replacement* order's id, joined back to
    // the original order for its number so the admin panel can badge and
    // link it without a second round trip.
    let replacementData: any[] = [];
    if (orderIds.length > 0) {
      try {
        replacementData = await this.dataSource.query(
          `SELECT r.completed_order_id, r.return_number, r.status, r.order_id AS original_order_id,
                  o.order_number AS original_order_number
           FROM returns r
           JOIN orders o ON o.id = r.order_id
           WHERE r.completed_order_id = ANY($1)`,
          [orderIds],
        );
      } catch (error) {
        console.log('Could not load replacement-order links, skipping:', error);
      }
    }
    const replacementByOrder = replacementData.reduce((acc: any, row: any) => {
      acc[row.completed_order_id] = {
        returnNumber: row.return_number,
        exchangeStatus: row.status,
        originalOrderId: row.original_order_id,
        originalOrderNumber: row.original_order_number,
      };
      return acc;
    }, {});

    // Transform orders to include returns
    return orders.map(order => {
      const transformed = this.transformOrder(order, exchangeWindowDays);
      return {
        ...transformed,
        returns: returnsByOrder[order.id] || [],
        replacementForExchange: replacementByOrder[order.id] || null,
      };
    });
  }

  /** Whether the order belongs to this customer — for checks that need no more. */
  async isOwnedBy(id: string, userId: string): Promise<boolean> {
    return (await this.orderRepository.count({ where: { id, userId } })) > 0;
  }

  async findOne(id: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
      relations: ['items', 'items.product', 'payments', 'invoices'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const exchangeWindowDays = await this.getExchangeWindowDays();
    return this.transformOrder(order, exchangeWindowDays);
  }

  /** Puts cancelled or refused items back on the shelf and undoes their sales credit. */
  private async restock(items: OrderItem[]) {
    for (const item of items) {
      if (item.variantId) {
        await this.productVariantsRepository.increment({ id: item.variantId }, 'stockQuantity', item.quantity);
        const variants = await this.productVariantsRepository.find({ where: { productId: item.productId } });
        const total = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        await this.productRepository.update(item.productId, { stockQuantity: total });
      } else {
        await this.productRepository.increment({ id: item.productId }, 'stockQuantity', item.quantity);
      }
      // A cancelled sale never happened: undo the popularity credit given when the
      // order was placed, or cancellations would promote products no one kept.
      await this.productRepository.decrement({ id: item.productId }, 'salesCount', item.quantity);

      const product = await this.productRepository.findOne({ where: { id: item.productId } });
      if (product) this.marketplaceGateway.emitStockUpdate(product.id, product.stockQuantity);
    }
  }

  /**
   * The admin-set exchange window. Duplicated (rather than shared with
   * `ExchangesService`) to avoid a circular module dependency for a
   * three-line settings lookup.
   */
  private async getExchangeWindowDays(): Promise<number> {
    const raw = await this.settingsService.getSetting('exchange_window_days');
    const days = Number(raw);
    return Number.isFinite(days) && days > 0 ? days : 7;
  }

  private transformOrder(order: Order, exchangeWindowDays: number) {
    // Find customer invoice if available
    const customerInvoice = order.invoices?.find((inv) => inv.type === InvoiceType.CUSTOMER);

    // Computed server-side so the client never re-implements the cancellation
    // and exchange policy — a rule duplicated in two places drifts. See Task 8.
    // Cancellation is allowed up to (not including) SHIPPED regardless of
    // payment status — a paid order that's cancelled is refunded to store
    // credit, see `cancel()`.
    const canCancel =
      order.status === OrderStatus.PENDING ||
      order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.PROCESSING;

    // Whether the customer can still settle this order online. Anything left
    // owing on a card/UPI order is payable until the order is cancelled —
    // including a payment that was dismissed or declined at checkout, and the
    // replacement order an exchange creates (see
    // `ExchangesService.createReplacementOrder`), which is placed by an admin
    // with nobody at a checkout screen to pay it. COD orders are excluded:
    // there is nothing to collect online, the courier collects at the door.
    const canPayOnline =
      order.paymentMethod === 'razorpay' &&
      (order.paymentStatus === PaymentStatus.PENDING || order.paymentStatus === PaymentStatus.FAILED) &&
      order.status !== OrderStatus.CANCELLED &&
      Number(order.total) > 0;

    let canExchange = false;
    let exchangeWindowExpiresAt: string | null = null;
    if (order.status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PAID && order.deliveredAt) {
      const deliveredAt = new Date(order.deliveredAt);
      const expiresAt = new Date(deliveredAt.getTime() + exchangeWindowDays * 24 * 60 * 60 * 1000);
      exchangeWindowExpiresAt = expiresAt.toISOString();
      canExchange = Date.now() <= expiresAt.getTime();
    }

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
      paymentMethod: order.paymentMethod || (order.paymentStatus === 'pending' ? 'cod' : 'razorpay'),
      // Add customer invoice info for easy access
      invoice: customerInvoice ? {
        id: customerInvoice.id,
        invoiceNumber: customerInvoice.invoiceNumber,
        invoiceDate: customerInvoice.invoiceDate,
        status: customerInvoice.status,
        downloadUrl: `/api/v1/orders/${order.id}/invoice/download`,
        viewUrl: `/api/v1/invoices/${customerInvoice.id}/pdf`,
      } : null,
      canCancel,
      canExchange,
      canPayOnline,
      exchangeWindowExpiresAt,
    };
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    reason?: string,
    shipment?: { trackingNumber?: string; carrier?: string },
  ) {
    
    const order = await this.orderRepository.findOne({ 
      where: { id },
      relations: ['user', 'items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;

    // Admin rejection is only meaningful before the order has shipped — see
    // the fulfilment rules in Task 8. Once it is in transit or delivered, the
    // exchange flow is the only path back, not cancellation.
    if (
      status === OrderStatus.CANCELLED &&
      previousStatus !== OrderStatus.PENDING &&
      previousStatus !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot cancel an order that is already ${previousStatus}. ` +
        'Once shipped, only an exchange is available after delivery.',
      );
    }

    order.status = status;

    if (status === OrderStatus.CONFIRMED) {
      order.confirmedAt = new Date();
      this.notificationsService
        .notifyUser(order.userId, NotificationType.ORDER_CONFIRMED, `Order #${order.orderNumber} confirmed`, {
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of confirmation:', err));
    } else if (status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
      // Recorded before the notification below so the customer's bell
      // carries the tracking number the admin typed when marking shipped.
      const trackingNumber = shipment?.trackingNumber?.trim();
      const carrier = shipment?.carrier?.trim();
      if (trackingNumber) order.trackingNumber = trackingNumber;
      if (carrier) order.carrier = carrier;
      this.notificationsService
        .notifyUser(order.userId, NotificationType.ORDER_SHIPPED, `Order #${order.orderNumber} shipped`, {
          body: order.trackingNumber
            ? `${order.carrier ? `${order.carrier} ` : ''}tracking: ${order.trackingNumber}`
            : undefined,
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of shipping:', err));
    } else if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();

      this.notificationsService
        .notifyUser(order.userId, NotificationType.ORDER_DELIVERED, `Order #${order.orderNumber} delivered`, {
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of delivery:', err));
    } else if (status === OrderStatus.CANCELLED) {
      order.cancelledAt = new Date();
      if (reason) {
        order.cancellationReason = reason;
        order.adminNotes = (order.adminNotes || '') + `\nCancellation reason: ${reason}`;
      }

      await this.restock(order.items ?? []);

      this.notificationsService
        .notifyUser(order.userId, NotificationType.ORDER_REJECTED, `Order #${order.orderNumber} could not be accepted`, {
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of rejection:', err));

      // A paid order that is cancelled owes the customer money. Rather than
      // parking it in REFUND_PENDING waiting on the Razorpay refund.processed
      // webhook — which is not configured, so it would sit there forever —
      // the amount is issued as store credit immediately.
      if (order.paymentStatus === PaymentStatus.PAID) {
        const { balance } = await this.walletService.credit(
          order.userId,
          Number(order.total),
          WalletLedgerType.ADMIN_CANCEL_CREDIT,
          { orderId: order.id, description: `Order #${order.orderNumber} cancelled after payment` },
        );
        order.paymentStatus = PaymentStatus.CREDITED;
        order.adminNotes = (order.adminNotes || '') +
          `\n₹${Number(order.total).toFixed(2)} issued as store credit (order cancelled) at ${new Date().toISOString()}. New wallet balance: ₹${balance.toFixed(2)}`;

        this.notificationsService
          .notifyUser(order.userId, NotificationType.ORDER_REJECTED, `₹${Number(order.total).toFixed(2)} credited to your wallet`, {
            body: `Order #${order.orderNumber} was cancelled after payment — the amount has been added to your store credit.`,
            link: '/orders', orderId: order.id,
          })
          .catch((err) => console.error('Failed to notify customer of cancellation credit:', err));

        try {
          await this.invoicesService.createCreditNote(order.id, 'Order cancelled');
        } catch (error) {
          console.error('Failed to create credit note for cancelled order:', error);
        }
      }
    }

    const savedOrder = await this.orderRepository.save(order);
    
    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, status, order.userId);
    
    
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
      this.notificationsService
        .notifyUser(order.userId, NotificationType.PAYMENT_RECEIVED, 'Payment received — invoice ready', {
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of payment:', err));
      this.notificationsService
        .notifyAdmins(NotificationType.PAYMENT_RECEIVED, `Payment received for order #${order.orderNumber}`, {
          link: '/admin/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify admins of payment:', err));

      try {
        if (!(await this.invoicesService.findByOrderAndType(order.id, InvoiceType.CUSTOMER))) {
          await this.invoicesService.createFromOrder({
            orderId: order.id,
            type: InvoiceType.CUSTOMER,
            notes: 'Thank you for your purchase!',
          });
        }
      } catch (error) {
        // The payment stands either way; the invoice can be generated later.
        console.error(`Failed to generate the invoice for order ${order.orderNumber}:`, error);
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

    // Cancellation is only available up to (not including) SHIPPED. A paid
    // order cancelled here is refunded to store credit below; once shipped
    // the store no longer cancels — a delivered order exchanges instead.
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException(
        'This order can no longer be cancelled — it has already shipped. ' +
        'Once delivered, a wrong or unwanted item can be exchanged instead.',
      );
    }

    await this.restock(order.items);

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    if (reason) {
      order.customerNotes = (order.customerNotes || '') + `\nCancellation reason: ${reason}`;
      order.cancellationReason = reason;
    }

    // A paid order that's cancelled owes the customer money. As with the
    // admin-cancel path in `updateStatus`, this is issued as store credit
    // immediately rather than queued behind a Razorpay refund webhook that
    // isn't configured.
    if (order.paymentStatus === PaymentStatus.PAID) {
      const { balance } = await this.walletService.credit(
        order.userId,
        Number(order.total),
        WalletLedgerType.CUSTOMER_CANCEL_CREDIT,
        { orderId: order.id, description: `Order #${order.orderNumber} cancelled by customer after payment` },
      );
      order.paymentStatus = PaymentStatus.CREDITED;
      order.customerNotes = (order.customerNotes || '') +
        `\n₹${Number(order.total).toFixed(2)} issued as store credit (order cancelled) at ${new Date().toISOString()}. New wallet balance: ₹${balance.toFixed(2)}`;

      this.notificationsService
        .notifyUser(order.userId, NotificationType.ORDER_CANCELLED, `₹${Number(order.total).toFixed(2)} credited to your wallet`, {
          body: `Order #${order.orderNumber} was cancelled — the amount you paid has been added to your store credit.`,
          link: '/orders', orderId: order.id,
        })
        .catch((err) => console.error('Failed to notify customer of cancellation credit:', err));

      try {
        await this.invoicesService.createCreditNote(order.id, 'Order cancelled by customer');
      } catch (error) {
        console.error('Failed to create credit note for customer-cancelled order:', error);
      }
    }

    // Emit order status update via WebSocket
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.CANCELLED, order.userId);

    this.notificationsService
      .notifyAdmins(NotificationType.ORDER_CANCELLED, `Customer cancelled order #${order.orderNumber}`, {
        link: '/admin/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify admins of customer cancellation:', err));

    return this.orderRepository.save(order);
  }

  /**
   * A dispatched COD order was refused at the door and the goods came back.
   * The customer never paid, so 'credit' here is a goodwill gesture the
   * admin decides the amount of — there is no payment to refund. 'nothing'
   * is for goods that came back tampered with: no stock restore, no credit,
   * the item is simply written off. The exchange decision is handled
   * separately by `resolveCodRefusalWithExchange`, since it needs a
   * replacement product, not just a decision.
   */
  async resolveCodRefusal(
    orderId: string,
    decision: 'credit' | 'nothing',
    options: { creditAmount?: number; reason?: string } = {},
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'user'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.paymentMethod !== 'cod') {
      throw new BadRequestException('This decision only applies to COD orders.');
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('This order has not been dispatched, or has already moved past this point.');
    }
    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('This order has already been marked paid — use the delivered/exchange flow instead.');
    }

    if (decision === 'credit') {
      // Goods are undamaged and coming back to stock.
      await this.restock(order.items);

      const creditAmount = Number(options.creditAmount ?? 0);
      if (creditAmount > 0) {
        const { balance } = await this.walletService.credit(
          order.userId,
          creditAmount,
          WalletLedgerType.COD_REFUSAL_CREDIT,
          { orderId: order.id, description: `Order #${order.orderNumber} refused at delivery` },
        );
        order.adminNotes = (order.adminNotes || '') +
          `\n₹${creditAmount.toFixed(2)} issued as goodwill store credit (COD refused) at ${new Date().toISOString()}. New wallet balance: ₹${balance.toFixed(2)}`;
      }
    } else {
      // Tampered — not resold, no credit. Stock is deliberately left alone.
      order.adminNotes = (order.adminNotes || '') +
        `\nGoods returned tampered/unsellable (COD refused) at ${new Date().toISOString()}. No credit issued, stock not restored.`;
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = options.reason || (decision === 'credit' ? 'COD delivery refused' : 'COD delivery refused — goods returned unsellable');

    const saved = await this.orderRepository.save(order);
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.CANCELLED, order.userId);

    this.notificationsService
      .notifyUser(order.userId, NotificationType.ORDER_CANCELLED, `Order #${order.orderNumber} — delivery refused`, {
        body: decision === 'credit' && Number(options.creditAmount ?? 0) > 0
          ? `₹${Number(options.creditAmount).toFixed(2)} has been added to your store credit.`
          : undefined,
        link: '/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify customer of COD refusal resolution:', err));

    return saved;
  }

  /**
   * A dispatched COD order was refused at the door and the customer asked
   * for a different item instead of a credit or nothing. Unlike a
   * post-delivery exchange, nothing was ever paid here, so there is no
   * value to credit — this simply restocks the refused item, cancels the
   * order it came on, and places a brand new order for the replacement,
   * exactly as if the customer had ordered it fresh.
   */
  async resolveCodRefusalWithExchange(
    orderId: string,
    productId: string,
    variantId: string,
    quantity: number,
    reason: string,
  ): Promise<{ cancelledOrder: Order; newOrder: Order }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product', 'user'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.paymentMethod !== 'cod') {
      throw new BadRequestException('This decision only applies to COD orders.');
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('This order has not been dispatched, or has already moved past this point.');
    }
    if (order.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('This order has already been marked paid — use the delivered/exchange flow instead.');
    }

    const variant = await this.productVariantsRepository.findOne({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw new NotFoundException('Requested replacement variant not found');
    }
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Requested replacement product not found');
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Quantity must be a whole number of at least 1');
    }

    // Goods are undamaged and coming back to stock — a customer asking to
    // exchange rather than just refusing implies they still want to buy
    // something from the store, not that the parcel is unsellable.
    await this.restock(order.items);

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'COD delivery refused — customer requested a different item';
    order.adminNotes = (order.adminNotes || '') + `\nReplaced with a new order after COD refusal at ${new Date().toISOString()}`;
    const cancelledOrder = await this.orderRepository.save(order);
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.CANCELLED, order.userId);

    const created = await this.create(order.userId, {
      items: [{ productId, variantId, quantity }],
      shippingAddress: {
        fullName: order.shippingName,
        email: order.shippingEmail,
        phone: order.shippingPhone,
        addressLine1: order.shippingAddress,
        city: order.shippingCity,
        state: order.shippingState,
        country: order.shippingCountry,
        postalCode: order.shippingPostalCode,
      },
      billingAddress: order.billingAddressSameAsShipping ? undefined : {
        fullName: order.billingName,
        email: order.billingEmail,
        phone: order.billingPhone,
        addressLine1: order.billingAddress,
        city: order.billingCity,
        state: order.billingState,
        country: order.billingCountry,
        postalCode: order.billingPostalCode,
      },
      useWalletBalance: true,
    }, undefined, { shippingCost: 0, paymentMethod: 'cod' });
    const newOrder = Array.isArray(created) ? created[0] : created;

    this.notificationsService
      .notifyUser(order.userId, NotificationType.ORDER_CONFIRMED, `New order #${newOrder.orderNumber} placed for your exchange`, {
        body: `Order #${order.orderNumber} was cancelled after the refused delivery and replaced with this one.`,
        link: '/orders', orderId: newOrder.id,
      })
      .catch((err) => console.error('Failed to notify customer of COD-refusal replacement order:', err));

    return { cancelledOrder, newOrder };
  }

  /**
   * Razorpay has confirmed the money is back with the customer. The only place
   * an order is allowed to reach REFUNDED — everything upstream can do no more
   * than mark a refund as owed.
   */
  async markRefundSettled(orderId: string) {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      console.warn(`[markRefundSettled] Order ${orderId} not found`);
      return null;
    }

    if (order.paymentStatus === PaymentStatus.REFUNDED) {
      return order; // Webhook redelivery.
    }

    order.paymentStatus = PaymentStatus.REFUNDED;
    order.adminNotes = (order.adminNotes || '') +
      `\nRefund settled by payment gateway at ${new Date().toISOString()}`;

    const saved = await this.orderRepository.save(order);
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, order.status, order.userId);
    return saved;
  }

  /**
   * The payment failed or the customer abandoned the gateway. The order was
   * created before payment was attempted and is holding stock, so release it
   * and take the order out of play rather than leaving it pending forever.
   *
   * Safe to call more than once — Razorpay redelivers webhooks, and the
   * checkout page reports dismissals too.
   */
  async markPaymentFailed(orderId: string, reason?: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      console.warn(`[markPaymentFailed] Order ${orderId} not found`);
      return null;
    }

    // Already paid (a late failure event for a retried payment), or already
    // dealt with — leave it alone.
    if (order.paymentStatus === PaymentStatus.PAID) {
      console.log(`[markPaymentFailed] Order ${order.orderNumber} is already paid; ignoring`);
      return order;
    }
    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }
    if (order.status !== OrderStatus.PENDING) {
      console.warn(
        `[markPaymentFailed] Order ${order.orderNumber} is ${order.status}; not cancelling automatically`,
      );
      return order;
    }

    // Release the stock reserved when the order was placed.
    await this.restock(order.items);

    order.status = OrderStatus.CANCELLED;
    order.paymentStatus = PaymentStatus.FAILED;
    order.cancelledAt = new Date();
    order.adminNotes = (order.adminNotes || '') +
      `\nCancelled automatically — payment failed at ${new Date().toISOString()}` +
      (reason ? `: ${reason}` : '');

    const saved = await this.orderRepository.save(order);
    this.marketplaceGateway.emitOrderStatusUpdate(order.id, OrderStatus.CANCELLED, order.userId);
    console.log(`[markPaymentFailed] Cancelled ${order.orderNumber} and released its stock`);

    this.notificationsService
      .notifyUser(order.userId, NotificationType.PAYMENT_FAILED, `Payment failed for order #${order.orderNumber}`, {
        body: 'The order was released.',
        link: '/orders', orderId: order.id,
      })
      .catch((err) => console.error('Failed to notify customer of payment failure:', err));

    return saved;
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
  async downloadOrderInvoice(orderId: string, user: { id: string; role?: UserRole }, res: Response) {
    // Customers get their own orders; admins any.
    const order = await this.orderRepository.findOne({
      where: isStoreAdmin(user) ? { id: orderId } : { id: orderId, userId: user.id },
      relations: ['invoices', 'user'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Find customer invoice
    let customerInvoice = order.invoices?.find(
      (inv) => inv.type === InvoiceType.CUSTOMER && !inv.invoiceNumber?.startsWith('CN-'),
    );

    // If invoice doesn't exist but order is paid, generate it now
    if (!customerInvoice && order.paymentStatus === PaymentStatus.PAID) {
      try {
        const createdInvoice = await this.invoicesService.createFromOrder({
          orderId: order.id,
          type: InvoiceType.CUSTOMER,
          notes: 'Thank you for your purchase!',
        });
        customerInvoice = createdInvoice as any;
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
}
