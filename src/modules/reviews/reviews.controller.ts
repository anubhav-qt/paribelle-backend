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
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('products')
  @UseGuards(JwtAuthGuard)
  async createProductReview(@Req() req, @Body() body: CreateReviewDto) {
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
    return this.reviewsService.getProductReviews(productId, pageNum, limitNum);
  }

  @Get('products/user/:orderItemId')
  @UseGuards(JwtAuthGuard)
  async getUserProductReview(@Req() req, @Param('orderItemId') orderItemId: string) {
    return this.reviewsService.getUserProductReview(req.user.id, orderItemId);
  }

  @Put('products/:reviewId')
  @UseGuards(JwtAuthGuard)
  async updateProductReview(@Req() req, @Param('reviewId') reviewId: string, @Body() body: UpdateReviewDto) {
    return this.reviewsService.updateProductReview(reviewId, req.user.id, body.rating, body.comment, body.images);
  }

  @Delete('products/:reviewId')
  @UseGuards(JwtAuthGuard)
  async deleteProductReview(@Req() req, @Param('reviewId') reviewId: string) {
    await this.reviewsService.deleteProductReview(reviewId, req.user.id);
    return { message: 'Review deleted successfully' };
  }

  // Recalculate product rating (admin utility)
  @Post('products/:productId/recalculate')
  @AdminOnly()
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
}
