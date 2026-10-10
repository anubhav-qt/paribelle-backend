import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, Res, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly, isStoreAdmin } from '../../common/decorators/admin-only.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { Product } from './product.entity';

// Define Multer File type to avoid Express namespace issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private productsExcelService: ProductsExcelService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all products (drafts and archived ones only for admins)' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'filters', required: false, description: 'JSON string of filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'uncategorized', required: false })
  @ApiQuery({ name: 'productType', required: false })
  @ApiQuery({ name: 'stock', required: false, description: 'Filter by stock level: low | out (admin panel)' })
  async findAll(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('filters') filters?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('uncategorized') uncategorized?: string,
    @Query('productType') productType?: string,
    @Query('stock') stock?: string,
  ) {
    // Shoppers only ever see what is on sale, a page at a time.
    const admin = isStoreAdmin(req.user);
    if (!admin) status = 'active';

    if (categoryId) {
      let parsedFilters: Record<string, any> = {};
      try {
        parsedFilters = filters ? JSON.parse(filters) : {};
      } catch {
        throw new BadRequestException('filters must be JSON');
      }
      if (productType) parsedFilters.productType = productType;
      return this.productsService.findByCategory(categoryId, parsedFilters);
    }
    
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), admin ? 1000 : 100);
    const isUncategorized = uncategorized === 'true';
    
    const stockFilter = stock === 'low' || stock === 'out' ? stock : undefined;
    return this.productsService.findAll(pageNum, limitNum, status, search, isUncategorized, productType, stockFilter);
  }

  @Get('template-simple/download')
  @AdminOnly()
  @ApiOperation({ summary: 'Download simple physical-product template (ZIP with sample Excel + images)' })
  async downloadSimpleTemplate(@Res() res: Response) {
    const buffer = await this.productsExcelService.generateSimpleTemplate();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=products-template-simple-${Date.now()}.zip`);
    res.send(buffer);
  }

  @Get(['export-simple', 'export-simple/:scope'])
  @AdminOnly()
  @ApiOperation({ summary: 'Export physical products as simple ZIP. Pass ?ids=id1,id2 to export selected products.' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated product IDs to export (optional)' })
  async exportSimplePhysical(@Query('ids') ids: string, @Res() res: Response) {
    const productIds = ids ? ids.split(',').map(id => id.trim()).filter(Boolean) : undefined;
    const buffer = await this.productsExcelService.exportSimplePhysicalZip(productIds);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=products-physical-${Date.now()}.zip`);
    res.send(buffer);
  }

  @Post(['import-simple', 'import-simple/:scope'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import physical products from simple ZIP (admin only)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importSimplePhysical(
    @UploadedFile() file: MulterFile,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) throw new BadRequestException('No ZIP file uploaded');
    // `?dryRun=true` validates the whole workbook and reports every row error
    // without writing anything.
    const isDryRun = dryRun === 'true' || dryRun === '1';
    try {
      const result = await this.productsExcelService.importSimplePhysicalZip(
        file.buffer,
        { dryRun: isDryRun },
      );
      const success = result.created > 0 || result.updated > 0;
      const rowErrors = result.errors.length > 0 ? ` with ${result.errors.length} row error(s)` : '';
      return {
        success,
        message: isDryRun
          ? result.errors.length > 0
            ? `Validation found ${result.errors.length} problem(s). Nothing was imported.`
            : `Validation passed: ${result.created} would be created, ${result.updated} updated. Nothing was imported.`
          : success
            ? `Import completed: ${result.created} created, ${result.updated} updated${rowErrors}`
            : result.errors.length > 0
              ? `Import failed — no products were created or updated`
              : 'Import failed: No products were created or updated. Check that the sheet is named "Products".',
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Import failed due to an unexpected error',
        errors: [error.message || 'Unknown error'],
        created: 0,
        updated: 0,
      };
    }
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get product by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  /**
   * Counts over the whole catalogue, not one paginated response — see
   * ProductsService.getAdminStats. Must stay above `:id` below or Nest will
   * try to look up a product named "stats".
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Product counts by status and stock level (admin only)' })
  async getAdminStats() {
    return this.productsService.getAdminStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get(':id/variants')
  @ApiOperation({ summary: 'Get product variants' })
  async getProductVariants(@Param('id') id: string) {
    return this.productsService.getProductVariants(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (admin only)' })
  async create(@Body() productData: Partial<Product>) {
    return this.productsService.create(productData);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (admin only)' })
  async update(@Param('id') id: string, @Body() productData: Partial<Product>) {
    return this.productsService.update(id, productData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (admin only)' })
  async remove(@Param('id') id: string) {
    const { outcome } = await this.productsService.remove(id);

    const message = {
      deleted: 'Product deleted successfully',
      archived:
        'This product has order or booking history, so it was archived instead of deleted — deleting it would break past orders.',
      already_archived:
        'This product has order or booking history and is already archived. It cannot be permanently deleted.',
    }[outcome];

    return { message, outcome };
  }

  @Post('admin/cleanup-orphan-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Find and optionally delete orphan images from Cloudinary (Admin only)' })
  @ApiQuery({ name: 'delete', required: false, description: 'Set to "true" to actually delete orphans' })
  async cleanupOrphanImages(@Query('delete') shouldDelete?: string) {
    try {
      const deleteOrphans = shouldDelete === 'true';
      const result = await this.productsService.cleanupOrphanImages(deleteOrphans);
      
      return {
        success: true,
        message: deleteOrphans 
          ? `Cleanup completed: ${result.deleted} orphan images deleted` 
          : `Found ${result.orphans.length} orphan images (use ?delete=true to remove them)`,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
