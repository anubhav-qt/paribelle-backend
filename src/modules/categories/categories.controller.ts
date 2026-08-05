import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CategoriesService } from './categories.service';
import { UpdateCategoryFiltersDto } from './dto/category-filter.dto';

/** Browsing the category tree is public; changing it is admin-only. */
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (admin only)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category (admin only)' })
  async update(@Param('id') id: string, @Body() categoryData: any) {
    return this.categoriesService.update(id, categoryData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete category (admin only)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
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

  @Get(':id/filters/effective')
  @ApiOperation({
    summary:
      'Filters the storefront should render for this category — derived live from the catalogue, with filterConfig applied only as label/order/hide overrides',
  })
  async getEffectiveFilters(@Param('id') id: string) {
    return this.categoriesService.getEffectiveFilters(id);
  }

  @Get(':id/filter-suggestions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Filters derived from the attributes this category's variants carry (admin only)",
  })
  async getFilterSuggestions(@Param('id') id: string) {
    return this.categoriesService.suggestFiltersFromCatalogue(id);
  }
}
