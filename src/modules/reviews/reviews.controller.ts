import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Product Reviews
  @Post('products')
  @UseGuards(JwtAuthGuard)
  async createProductReview(
    @Req() req,
    @Body()
    body: {
      productId: string;
      rating: number;
      comment: string;
      orderItemId?: string;
      images?: string[];
    },
  ) {
    return this.reviewsService.createProductReview(
      req.user.id,
      body.productId,
      body.rating,
      body.comment,
      body.orderItemId,
      body.images,
    );
  }

  @Get('products/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.reviewsService.getProductReviews(productId, page, limit);
  }

  @Get('products/user/:orderItemId')
  @UseGuards(JwtAuthGuard)
  async getUserProductReview(@Req() req, @Param('orderItemId') orderItemId: string) {
    return this.reviewsService.getUserProductReview(req.user.id, orderItemId);
  }

  @Put('products/:reviewId')
  @UseGuards(JwtAuthGuard)
  async updateProductReview(
    @Req() req,
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      rating: number;
      comment: string;
      images?: string[];
    },
  ) {
    return this.reviewsService.updateProductReview(
      reviewId,
      req.user.id,
      body.rating,
      body.comment,
      body.images,
    );
  }

  @Delete('products/:reviewId')
  @UseGuards(JwtAuthGuard)
  async deleteProductReview(@Req() req, @Param('reviewId') reviewId: string) {
    await this.reviewsService.deleteProductReview(reviewId, req.user.id);
    return { message: 'Review deleted successfully' };
  }

  // Vendor Reviews
  @Post('vendors')
  @UseGuards(JwtAuthGuard)
  async createVendorReview(
    @Req() req,
    @Body()
    body: {
      vendorId: string;
      rating: number;
      comment: string;
      orderId?: string;
      productQualityRating?: number;
      shippingSpeedRating?: number;
      customerServiceRating?: number;
    },
  ) {
    return this.reviewsService.createVendorReview(
      req.user.id,
      body.vendorId,
      body.rating,
      body.comment,
      body.orderId,
      body.productQualityRating,
      body.shippingSpeedRating,
      body.customerServiceRating,
    );
  }

  @Get('vendors/:vendorId')
  async getVendorReviews(
    @Param('vendorId') vendorId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.reviewsService.getVendorReviews(vendorId, page, limit);
  }

  @Get('vendors/:vendorId/stats')
  async getVendorStats(@Param('vendorId') vendorId: string) {
    return this.reviewsService.getVendorStats(vendorId);
  }

  @Get('vendors/user/:orderId')
  @UseGuards(JwtAuthGuard)
  async getUserVendorReview(@Req() req, @Param('orderId') orderId: string) {
    return this.reviewsService.getUserVendorReview(req.user.id, orderId);
  }

  @Put('vendors/:reviewId')
  @UseGuards(JwtAuthGuard)
  async updateVendorReview(
    @Req() req,
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      rating: number;
      comment: string;
      productQualityRating?: number;
      shippingSpeedRating?: number;
      customerServiceRating?: number;
    },
  ) {
    return this.reviewsService.updateVendorReview(
      reviewId,
      req.user.id,
      body.rating,
      body.comment,
      body.productQualityRating,
      body.shippingSpeedRating,
      body.customerServiceRating,
    );
  }

  @Delete('vendors/:reviewId')
  @UseGuards(JwtAuthGuard)
  async deleteVendorReview(@Req() req, @Param('reviewId') reviewId: string) {
    await this.reviewsService.deleteVendorReview(reviewId, req.user.id);
    return { message: 'Review deleted successfully' };
  }

  // Vendor Responses
  @Post('products/:reviewId/response')
  @UseGuards(JwtAuthGuard)
  async addVendorResponseToProductReview(
    @Req() req,
    @Param('reviewId') reviewId: string,
    @Body() body: { response: string },
  ) {
    return this.reviewsService.addVendorResponseToProductReview(
      reviewId,
      req.user.vendorId,
      body.response,
    );
  }

  @Post('vendors/:reviewId/response')
  @UseGuards(JwtAuthGuard)
  async addVendorResponseToVendorReview(
    @Req() req,
    @Param('reviewId') reviewId: string,
    @Body() body: { response: string },
  ) {
    return this.reviewsService.addVendorResponseToVendorReview(
      reviewId,
      req.user.vendorId,
      body.response,
    );
  }

  // Recalculate product rating (admin utility)
  @Post('products/:productId/recalculate')
  async recalculateProductRating(@Param('productId') productId: string) {
    await this.reviewsService.updateProductRating(productId);
    return { message: 'Product rating recalculated successfully' };
  }

  // Order Reviews
  @Get('orders/:orderId/items')
  @UseGuards(JwtAuthGuard)
  async getOrderItemsWithReviews(@Req() req, @Param('orderId') orderId: string) {
    return this.reviewsService.getOrderItemsWithReviews(orderId, req.user.id);
  }

  @Get('orders/:orderId/vendor-review')
  @UseGuards(JwtAuthGuard)
  async getOrderVendorReview(@Req() req, @Param('orderId') orderId: string) {
    const review = await this.reviewsService.getOrderVendorReview(orderId, req.user.id);
    return review || { review: null };
  }
}
