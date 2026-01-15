import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { VendorReview } from './vendor-review.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Cache } from 'cache-manager';
import { CACHE_KEYS, CACHE_TTL } from '../cache/cache.constants';
import { MarketplaceGateway } from '../stock/stock.gateway';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(VendorReview)
    private vendorReviewRepository: Repository<VendorReview>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private marketplaceGateway: MarketplaceGateway,
  ) {}

  // Product Reviews
  async createProductReview(
    userId: string,
    productId: string,
    rating: number,
    comment: string,
    orderItemId?: string,
    images?: string[],
  ): Promise<Review> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if product exists
    const product = await this.productRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // If orderItemId is provided, verify the purchase
    let isVerifiedPurchase = false;
    if (orderItemId) {
      const orderItem = await this.orderItemRepository.findOne({
        where: { id: orderItemId },
        relations: ['order'],
      });

      if (!orderItem) {
        throw new NotFoundException('Order item not found');
      }

      if (orderItem.order.userId !== userId) {
        throw new ForbiddenException('You can only review products you have purchased');
      }

      if (orderItem.order.status !== OrderStatus.DELIVERED) {
        throw new BadRequestException('You can only review delivered orders');
      }

      // Check if already reviewed
      const existingReview = await this.reviewRepository.findOne({
        where: { orderItemId, userId },
      });

      if (existingReview) {
        throw new BadRequestException('You have already reviewed this product');
      }

      isVerifiedPurchase = true;
    }

    const review = this.reviewRepository.create({
      userId,
      productId,
      rating,
      comment,
      orderItemId,
      images: images || [],
      isVerifiedPurchase,
      isApproved: true, // Auto-approve for now
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update product average rating
    await this.updateProductRating(productId);

    // Invalidate product reviews cache
    await this.invalidateProductReviewsCache(productId);

    const result = await this.reviewRepository.findOne({
      where: { id: savedReview.id },
      relations: ['user', 'product'],
    });

    return result || savedReview;
  }

  async getProductReviews(
    productId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    // Check cache first
    const cacheKey = CACHE_KEYS.PRODUCT_REVIEWS(productId, page);
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached as any;
    }

    const queryBuilder = this.reviewRepository.createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.productId = :productId', { productId })
      .andWhere('(review.isApproved = :isApproved OR review.isApproved IS NULL)', { isApproved: true })
      .orderBy('review.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [reviews, total] = await queryBuilder.getManyAndCount();

    const averageRating = await this.getProductAverageRating(productId);

    const result = { reviews, total, averageRating };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  async getUserProductReview(userId: string, orderItemId: string): Promise<Review | null> {
    return this.reviewRepository.findOne({
      where: { userId, orderItemId },
      relations: ['product'],
    });
  }

  async updateProductReview(
    reviewId: string,
    userId: string,
    rating: number,
    comment: string,
    images?: string[],
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    review.rating = rating;
    review.comment = comment;
    if (images) {
      review.images = images;
    }

    const updatedReview = await this.reviewRepository.save(review);

    // Update product average rating
    await this.updateProductRating(review.productId);

    // Invalidate cache
    await this.invalidateProductReviewsCache(review.productId);

    return await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['user', 'product'],
    }) || updatedReview;
  }

  async deleteProductReview(reviewId: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const productId = review.productId;
    await this.reviewRepository.remove(review);

    // Update product average rating
    await this.updateProductRating(productId);

    // Invalidate cache
    await this.invalidateProductReviewsCache(productId);
  }

  // Vendor Reviews
  async createVendorReview(
    userId: string,
    vendorId: string,
    rating: number,
    comment: string,
    orderId?: string,
    productQualityRating?: number,
    shippingSpeedRating?: number,
    customerServiceRating?: number,
  ): Promise<VendorReview> {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Check if vendor exists
    const vendor = await this.vendorRepository.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // If orderId is provided, verify the purchase
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.userId !== userId) {
        throw new ForbiddenException('You can only review vendors you have purchased from');
      }

      if (order.vendorId !== vendorId) {
        throw new BadRequestException('This order is not from this vendor');
      }

      if (order.status !== OrderStatus.DELIVERED) {
        throw new BadRequestException('You can only review delivered orders');
      }

      // Check if already reviewed
      const existingReview = await this.vendorReviewRepository.findOne({
        where: { orderId, userId },
      });

      if (existingReview) {
        throw new BadRequestException('You have already reviewed this vendor for this order');
      }

      isVerifiedPurchase = true;
    }

    const review = this.vendorReviewRepository.create({
      userId,
      vendorId,
      rating,
      comment,
      orderId,
      productQualityRating,
      shippingSpeedRating,
      customerServiceRating,
      isVerifiedPurchase,
      isApproved: true, // Auto-approve for now
    });

    const savedReview = await this.vendorReviewRepository.save(review);

    // Invalidate vendor reviews cache
    await this.invalidateVendorReviewsCache(vendorId);

    return await this.vendorReviewRepository.findOne({
      where: { id: savedReview.id },
      relations: ['user', 'vendor'],
    }) || savedReview;
  }

  async getVendorReviews(
    vendorId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ reviews: VendorReview[]; total: number; averageRating: number; stats: any }> {
    // Check cache first
    const cacheKey = CACHE_KEYS.VENDOR_REVIEWS(vendorId, page);
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached as any;
    }

    const [reviews, total] = await this.vendorReviewRepository.findAndCount({
      where: { vendorId, isApproved: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const stats = await this.getVendorRatingStats(vendorId);

    const result = { reviews, total, averageRating: stats.averageRating, stats };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  async getUserVendorReview(userId: string, orderId: string): Promise<VendorReview | null> {
    return this.vendorReviewRepository.findOne({
      where: { userId, orderId },
      relations: ['vendor'],
    });
  }

  async getVendorStats(vendorId: string): Promise<any> {
    // Check cache first
    const cacheKey = CACHE_KEYS.VENDOR_STATS(vendorId);
    const cached = await this.cacheManager.get(cacheKey);
    
    if (cached) {
      return cached as any;
    }

    const stats = await this.getVendorRatingStats(vendorId);

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, stats, CACHE_TTL.MEDIUM);

    return {
      averageRating: stats.averageRating,
      averageProductQuality: stats.productQuality,
      averageShippingSpeed: stats.shippingSpeed,
      averageCustomerService: stats.customerService,
      totalReviews: stats.totalReviews,
    };
  }

  async updateVendorReview(
    reviewId: string,
    userId: string,
    rating: number,
    comment: string,
    productQualityRating?: number,
    shippingSpeedRating?: number,
    customerServiceRating?: number,
  ): Promise<VendorReview> {
    const review = await this.vendorReviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    review.rating = rating;
    review.comment = comment;
    if (productQualityRating !== undefined) {
      review.productQualityRating = productQualityRating;
    }
    if (shippingSpeedRating !== undefined) {
      review.shippingSpeedRating = shippingSpeedRating;
    }
    if (customerServiceRating !== undefined) {
      review.customerServiceRating = customerServiceRating;
    }

    const vendorId = review.vendorId;
    const result = await this.vendorReviewRepository.save(review);

    // Invalidate cache
    await this.invalidateVendorReviewsCache(vendorId);

    return result;
  }

  async deleteVendorReview(reviewId: string, userId: string): Promise<void> {
    const review = await this.vendorReviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const vendorId = review.vendorId;
    await this.vendorReviewRepository.remove(review);

    // Invalidate cache
    await this.invalidateVendorReviewsCache(vendorId);
  }

  // Vendor Response
  async addVendorResponseToProductReview(
    reviewId: string,
    vendorId: string,
    response: string,
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['product'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.product.vendorId !== vendorId) {
      throw new ForbiddenException('You can only respond to reviews for your products');
    }

    review.vendorResponse = response;
    review.vendorResponseDate = new Date();

    return this.reviewRepository.save(review);
  }

  async addVendorResponseToVendorReview(
    reviewId: string,
    vendorId: string,
    response: string,
  ): Promise<VendorReview> {
    const review = await this.vendorReviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.vendorId !== vendorId) {
      throw new ForbiddenException('You can only respond to reviews for your store');
    }

    review.vendorResponse = response;
    review.vendorResponseDate = new Date();

    return this.vendorReviewRepository.save(review);
  }

  // Helper methods
  async updateProductRating(productId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.productId = :productId', { productId })
      .andWhere('(review.isApproved = :isApproved OR review.isApproved IS NULL)', { isApproved: true })
      .getRawOne();

    const averageRating = result?.average ? parseFloat(result.average) : 0;
    const reviewCount = result?.count ? parseInt(result.count) : 0;

    await this.productRepository.update(productId, {
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount,
    });
    
    // Emit rating update via WebSocket
    this.marketplaceGateway.emitProductRatingUpdate(
      productId,
      Math.round(averageRating * 10) / 10,
      reviewCount
    );
  }

  private async getProductAverageRating(productId: string): Promise<number> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.productId = :productId', { productId })
      .andWhere('(review.isApproved = :isApproved OR review.isApproved IS NULL)', { isApproved: true })
      .getRawOne();

    return result?.average ? Math.round(parseFloat(result.average) * 10) / 10 : 0;
  }

  private async getVendorRatingStats(vendorId: string): Promise<any> {
    const result = await this.vendorReviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'averageRating')
      .addSelect('AVG(review.productQualityRating)', 'productQuality')
      .addSelect('AVG(review.shippingSpeedRating)', 'shippingSpeed')
      .addSelect('AVG(review.customerServiceRating)', 'customerService')
      .addSelect('COUNT(*)', 'totalReviews')
      .where('review.vendorId = :vendorId', { vendorId })
      .andWhere('review.isApproved = :isApproved', { isApproved: true })
      .getRawOne();

    return {
      averageRating: result?.averageRating ? Math.round(parseFloat(result.averageRating) * 10) / 10 : 0,
      productQuality: result?.productQuality ? Math.round(parseFloat(result.productQuality) * 10) / 10 : 0,
      shippingSpeed: result?.shippingSpeed ? Math.round(parseFloat(result.shippingSpeed) * 10) / 10 : 0,
      customerService: result?.customerService ? Math.round(parseFloat(result.customerService) * 10) / 10 : 0,
      totalReviews: parseInt(result?.totalReviews || '0'),
    };
  }

  // Get reviews by order for customer
  async getOrderItemsWithReviews(orderId: string, userId: string): Promise<any[]> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.product'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You can only view your own orders');
    }

    const itemsWithReviews = await Promise.all(
      order.items.map(async (item) => {
        const review = await this.reviewRepository.findOne({
          where: { orderItemId: item.id, userId },
          relations: ['user'],
        });

        return {
          ...item,
          review,
        };
      }),
    );

    return itemsWithReviews;
  }

  async getOrderVendorReview(orderId: string, userId: string): Promise<VendorReview | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return this.vendorReviewRepository.findOne({
      where: { orderId, userId },
      relations: ['vendor', 'user'],
    });
  }

  // Cache invalidation helpers
  private async invalidateProductReviewsCache(productId: string): Promise<void> {
    // Invalidate first 10 pages of reviews (should cover most cases)
    const invalidations: Promise<any>[] = [];
    for (let page = 1; page <= 10; page++) {
      invalidations.push(
        this.cacheManager.del(CACHE_KEYS.PRODUCT_REVIEWS(productId, page))
      );
    }
    await Promise.all(invalidations);
  }

  private async invalidateVendorReviewsCache(vendorId: string): Promise<void> {
    // Invalidate first 10 pages of reviews and stats
    const invalidations: Promise<any>[] = [
      this.cacheManager.del(CACHE_KEYS.VENDOR_STATS(vendorId)),
    ];
    
    for (let page = 1; page <= 10; page++) {
      invalidations.push(
        this.cacheManager.del(CACHE_KEYS.VENDOR_REVIEWS(vendorId, page))
      );
    }
    
    await Promise.all(invalidations);
  }
}
