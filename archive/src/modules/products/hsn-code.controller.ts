import { Controller, Get, Query, Param } from '@nestjs/common';
import { HsnCodeService } from './hsn-code.service';

@Controller('hsn-codes')
export class HsnCodeController {
  constructor(private readonly hsnCodeService: HsnCodeService) {}

  /**
   * Search HSN codes - for autocomplete
   * GET /api/v1/hsn-codes/search?q=tshirt
   */
  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 10;
    return this.hsnCodeService.searchHsnCodes(query, limitNum);
  }

  /**
   * Get HSN code details by code
   * GET /api/v1/hsn-codes/6109
   */
  @Get(':code')
  async getByCode(@Param('code') code: string) {
    return this.hsnCodeService.getByCode(code);
  }

  /**
   * Get all categories
   * GET /api/v1/hsn-codes/categories
   */
  @Get('meta/categories')
  async getCategories() {
    return this.hsnCodeService.getCategories();
  }

  /**
   * Get HSN codes by category
   * GET /api/v1/hsn-codes/category/Electronics
   */
  @Get('category/:category')
  async getByCategory(@Param('category') category: string) {
    return this.hsnCodeService.getByCategory(category);
  }

  /**
   * Get recommended GST rate for HSN code
   * GET /api/v1/hsn-codes/6109/gst-rate
   */
  @Get(':code/gst-rate')
  async getGstRate(@Param('code') code: string) {
    const rate = await this.hsnCodeService.getRecommendedGstRate(code);
    return { hsnCode: code, recommendedGstRate: rate };
  }

  /**
   * Suggest HSN codes based on product details
   * GET /api/v1/hsn-codes/suggest?name=Cotton Tshirt&description=Men's casual wear
   */
  @Get('meta/suggest')
  async suggest(
    @Query('name') name: string,
    @Query('description') description?: string,
  ) {
    return this.hsnCodeService.suggestHsnCode(name, description);
  }
}
