import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order, OrderStatus } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { Cache } from 'cache-manager';
import { CACHE_KEYS, CACHE_TTL } from '../cache/cache.constants';
import { MarketplaceGateway } from '../stock/stock.gateway';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
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
    orderItemId: string,
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

    // Only a buyer reviews, once per order line, after it arrives.
    const orderItem = await this.orderItemRepository.findOne({
      where: { id: orderItemId },
      relations: ['order'],
    });
    if (!orderItem || orderItem.order.userId !== userId || orderItem.productId !== productId) {
      throw new ForbiddenException('You can only review products you have purchased');
    }
    if (orderItem.order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('You can only review delivered orders');
    }
    if (await this.reviewRepository.findOne({ where: { orderItemId, userId } })) {
      throw new BadRequestException('You have already reviewed this product');
    }
    const isVerifiedPurchase = true;

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

    // Only the reviewer's name and photo: the rest of the user row (email,
    // phone) must not reach a public page.
    const queryBuilder = this.reviewRepository.createQueryBuilder('review')
      .leftJoin('review.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.avatar'])
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
}
