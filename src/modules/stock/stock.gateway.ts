import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ==================== STOCK EVENTS ====================
  
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

  // ==================== ORDER EVENTS ====================
  
  emitOrderStatusUpdate(orderId: string, status: string, userId: string) {
    this.logger.log(`Emitting order status update: ${orderId} -> ${status}`);
    this.server.emit('orderStatusUpdated', {
      orderId,
      status,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  emitNewOrderForVendor(vendorId: string, orderData: any) {
    this.logger.log(`Emitting new order for vendor ${vendorId}`);
    this.server.emit('newVendorOrder', {
      vendorId,
      order: orderData,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== PRICE EVENTS ====================
  
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

  // ==================== REVIEW EVENTS ====================
  
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

  // ==================== PRODUCT EVENTS ====================
  
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
