import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Rooms a socket can belong to, beyond the implicit "everyone" it's always in. */
const userRoom = (userId: string) => `user:${userId}`;
const ADMIN_ROOM = 'role:admin';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches any allowed origin exactly
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check if origin matches subdomain pattern (*.localhost:3000)
      const subdomainPattern = /^http:\/\/[\w-]+\.localhost:3000$/;
      if (subdomainPattern.test(origin)) {
        return callback(null, true);
      }

      // Check for production subdomain pattern if needed
      const prodPattern = process.env.PRODUCTION_DOMAIN
        ? new RegExp(`^https?://[\\w-]+\\.${process.env.PRODUCTION_DOMAIN.replace('.', '\\.')}$`)
        : null;
      if (prodPattern && prodPattern.test(origin)) {
        return callback(null, true);
      }

      // Allow all Vercel preview and production deployments
      const vercelPattern = /^https:\/\/[\w-]+\.vercel\.app$/;
      if (vercelPattern.test(origin)) {
        return callback(null, true);
      }

      // If ALLOWED_ORIGINS is not set, allow all
      if (allowedOrigins.length === 0) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
})
export class MarketplaceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MarketplaceGateway');

  constructor(private jwtService: JwtService) {}

  /**
   * Every order-related emit used to be `server.emit(...)` — no rooms, no
   * handshake auth — so any connected socket received every other user's
   * order updates. The frontend already sends its JWT as `handshake.auth.token`
   * (see StockWebSocketContext.tsx); this verifies it and puts the socket in
   * a room scoped to its own user, plus an admin-wide room for admin roles.
   * A socket with no token, or an invalid one, still connects — it just gets
   * none of the private rooms, so it only ever receives the public events
   * (stock/price/review updates) that `server.emit` still broadcasts.
   */
  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = this.jwtService.verify(token);
        client.join(userRoom(payload.sub));
        if (payload.role === 'super_admin' || payload.role === 'vendor_admin') {
          client.join(ADMIN_ROOM);
        }
        this.logger.log(`Client connected: ${client.id} (user ${payload.sub})`);
        return;
      } catch (err) {
        this.logger.warn(`Client ${client.id} sent an invalid token; connecting without a private room`);
      }
    }
    this.logger.log(`Client connected: ${client.id} (anonymous)`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ==================== STOCK EVENTS (public) ====================

  emitStockUpdate(productId: string, stockQuantity: number) {
    this.logger.log(`Emitting stock update for product ${productId}: ${stockQuantity}`);
    this.server.emit('stockUpdated', {
      productId,
      stockQuantity,
      timestamp: new Date().toISOString(),
    });
  }

  emitBulkStockUpdate(updates: Array<{ productId: string; stockQuantity: number }>) {
    this.logger.log(`Emitting bulk stock update for ${updates.length} products`);
    this.server.emit('bulkStockUpdated', {
      updates,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== ORDER EVENTS (private — see handleConnection) ====================

  emitOrderStatusUpdate(orderId: string, status: string, userId: string) {
    this.logger.log(`Emitting order status update: ${orderId} -> ${status}`);
    this.server.to(userRoom(userId)).emit('orderStatusUpdated', {
      orderId,
      status,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewOrderForVendor(vendorId: string, orderData: any) {
    this.logger.log(`Emitting new order for vendor ${vendorId}`);
    // Every admin manages the single store's orders — there is no
    // per-vendor room to target instead.
    this.server.to(ADMIN_ROOM).emit('newVendorOrder', {
      vendorId,
      order: orderData,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== NOTIFICATION EVENTS (private) ====================

  emitNotificationToUser(userId: string, notification: any) {
    this.server.to(userRoom(userId)).emit('notification', notification);
  }

  emitNotificationToAdmins(notification: any) {
    this.server.to(ADMIN_ROOM).emit('notification', notification);
  }

  // ==================== PRICE EVENTS (public) ====================

  emitPriceUpdate(productId: string, newPrice: number, compareAtPrice?: number) {
    this.logger.log(`Emitting price update for product ${productId}: ${newPrice}`);
    this.server.emit('priceUpdated', {
      productId,
      price: newPrice,
      compareAtPrice,
      timestamp: new Date().toISOString(),
    });
  }

  emitBulkPriceUpdate(updates: Array<{ productId: string; price: number; compareAtPrice?: number }>) {
    this.logger.log(`Emitting bulk price update for ${updates.length} products`);
    this.server.emit('bulkPriceUpdated', {
      updates,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== REVIEW EVENTS (public) ====================

  emitNewReview(productId: string, reviewData: any) {
    this.logger.log(`Emitting new review for product ${productId}`);
    this.server.emit('newReview', {
      productId,
      review: reviewData,
      timestamp: new Date().toISOString(),
    });
  }

  emitProductRatingUpdate(productId: string, averageRating: number, reviewCount: number) {
    this.logger.log(`Emitting rating update for product ${productId}: ${averageRating} (${reviewCount} reviews)`);
    this.server.emit('productRatingUpdated', {
      productId,
      averageRating,
      reviewCount,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== PRODUCT EVENTS (public) ====================

  emitProductAvailabilityUpdate(productId: string, isActive: boolean) {
    this.logger.log(`Emitting availability update for product ${productId}: ${isActive ? 'active' : 'inactive'}`);
    this.server.emit('productAvailabilityUpdated', {
      productId,
      isActive,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewProduct(productData: any) {
    this.logger.log(`Emitting new product: ${productData.id}`);
    this.server.emit('newProduct', {
      product: productData,
      timestamp: new Date().toISOString(),
    });
  }
}
