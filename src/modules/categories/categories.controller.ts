import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { UpdateCategoryFiltersDto } from './dto/category-filter.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  async findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  async create(@Body() categoryData: any) {
    return this.categoriesService.create(categoryData);
  }

  @Get('root')
  @ApiOperation({ summary: 'Get root categories with children' })
  @ApiQuery({ name: 'vendorId', required: false })
  async findRoot(@Query('vendorId') vendorId?: string) {
    return this.categoriesService.findRootCategories(vendorId);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get category tree with hierarchy' })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'withProductCounts', required: false })
  async findTree(
    @Query('vendorId') vendorId?: string,
    @Query('withProductCounts') withProductCounts?: string,
  ) {
    const includeProductCounts = withProductCounts === 'true';
    return this.categoriesService.findRootCategories(vendorId, includeProductCounts);
  }

  @Get('tree/all')
  @ApiOperation({ summary: 'Get all categories tree (including inactive) - Admin only' })
  @ApiQuery({ name: 'vendorId', required: false })
  async findAllTree(@Query('vendorId') vendorId?: string) {
    return this.categoriesService.findAllRootCategories(vendorId);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get vendor-specific categories' })
  @ApiQuery({ name: 'withProductCounts', required: false })
  async findVendorCategories(
    @Param('vendorId') vendorId: string,
    @Query('withProductCounts') withProductCounts?: string,
  ) {
    const includeProductCounts = withProductCounts === 'true';
    return this.categoriesService.findVendorCategories(vendorId, includeProductCounts);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  async findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update category' })
  async update(@Param('id') id: string, @Body() categoryData: any) {
    return this.categoriesService.update(id, categoryData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete category' })
  async delete(@Param('id') id: string) {
    await this.categoriesService.remove(id);
    return { message: 'Category deleted successfully' };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get('slug/:slug/tree')
  @ApiOperation({ summary: 'Get category with children tree' })
  async findCategoryTree(@Param('slug') slug: string) {
    return this.categoriesService.findCategoryWithChildren(slug);
  }

  @Put(':id/filters')
  @ApiOperation({ summary: 'Update category filters (Admin only)' })
  @ApiBody({ type: UpdateCategoryFiltersDto })
  async updateFilters(
    @Param('id') id: string,
    @Body() filtersDto: UpdateCategoryFiltersDto,
  ) {
    return this.categoriesService.updateFilters(id, filtersDto);
  }

  @Get(':id/filters')
  @ApiOperation({ summary: 'Get category filters configuration' })
  async getFilters(@Param('id') id: string) {
    return this.categoriesService.getFilters(id);
  }
}
