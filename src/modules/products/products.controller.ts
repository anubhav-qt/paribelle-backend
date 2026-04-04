import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseInterceptors, UploadedFile, UploadedFiles, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
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
  @ApiOperation({ summary: 'Get all products' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'filters', required: false, description: 'JSON string of filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'uncategorized', required: false })
  @ApiQuery({ name: 'cityId', required: false })
  @ApiQuery({ name: 'subLocationId', required: false })
  @ApiQuery({ name: 'productType', required: false })
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('filters') filters?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('vendorId') vendorId?: string,
    @Query('uncategorized') uncategorized?: string,
    @Query('cityId') cityId?: string,
    @Query('subLocationId') subLocationId?: string,
    @Query('productType') productType?: string,
  ) {
    if (categoryId) {
      const parsedFilters = filters ? JSON.parse(filters) : {};
      // Add location filters to the filters object
      if (cityId) parsedFilters.cityId = cityId;
      if (subLocationId) parsedFilters.subLocationId = subLocationId;
      // Add productType filter to the filters object
      if (productType) parsedFilters.productType = productType;
      // Add vendorId filter to the filters object
      if (vendorId) parsedFilters.vendorId = vendorId;
      return this.productsService.findByCategory(categoryId, parsedFilters);
    }
    
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const isUncategorized = uncategorized === 'true';
    
    return this.productsService.findAll(pageNum, limitNum, status, search, vendorId, isUncategorized, cityId, subLocationId, productType);
  }

  @Get('template/download')
  @ApiOperation({ summary: 'Download product template with sample data and images' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.productsExcelService.generateSampleTemplate();
    
    res.setHeader(
      'Content-Type',
      'application/zip',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products-template-${Date.now()}.zip`,
    );
    
    res.send(buffer);
  }

  @Get('export/:vendorId')
  @ApiOperation({ summary: 'Export vendor products to Excel' })
  async exportProducts(
    @Param('vendorId') vendorId: string,
    @Res() res: Response,
  ) {
    // Handle 'all' for admin to export all products
    const targetVendorId = vendorId === 'all' ? null : vendorId;
    const buffer = await this.productsExcelService.exportToExcel(targetVendorId);
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products-${vendorId}-${Date.now()}.xlsx`,
    );
    
    res.send(buffer);
  }

  @Get('export-zip/:vendorId')
  @ApiOperation({ summary: 'Export vendor products to ZIP with images' })
  async exportToZip(
    @Param('vendorId') vendorId: string,
    @Res() res: Response,
  ) {
    // Handle 'all' for admin to export all products
    const targetVendorId = vendorId === 'all' ? null : vendorId;
    const buffer = await this.productsExcelService.exportToZip(targetVendorId);
    
    res.setHeader(
      'Content-Type',
      'application/zip',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products-${vendorId}-${Date.now()}.zip`,
    );
    
    res.send(buffer);
  }

  @Get('template-simple/download')
  @ApiOperation({ summary: 'Download simple physical-product template (ZIP with sample Excel + images)' })
  async downloadSimpleTemplate(@Res() res: Response) {
    const buffer = await this.productsExcelService.generateSimpleTemplate();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=products-template-simple-${Date.now()}.zip`);
    res.send(buffer);
  }

  @Get('export-simple/:vendorId')
  @ApiOperation({ summary: 'Export physical products as simple ZIP. Pass ?ids=id1,id2 to export selected products.' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated product IDs to export (optional)' })
  async exportSimplePhysical(
    @Param('vendorId') vendorId: string,
    @Query('ids') ids: string,
    @Res() res: Response,
  ) {
    const targetVendorId = vendorId === 'all' ? null : vendorId;
    const productIds = ids ? ids.split(',').map(id => id.trim()).filter(Boolean) : undefined;
    const buffer = await this.productsExcelService.exportSimplePhysicalZip(targetVendorId, productIds);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=products-physical-${Date.now()}.zip`);
    res.send(buffer);
  }

  @Post('import-simple/:vendorId')
  @ApiOperation({ summary: 'Import physical products from simple ZIP (products.xlsx + images/)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importSimplePhysical(
    @Param('vendorId') vendorId: string,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('No ZIP file uploaded');
    const actualVendorId = vendorId === 'all' ? null : vendorId;
    try {
      const result = await this.productsExcelService.importSimplePhysicalZip(actualVendorId, file.buffer);
      const success = result.created > 0 || result.updated > 0;
      return {
        success,
        message: success
          ? `Import completed: ${result.created} created, ${result.updated} updated${result.errors.length > 0 ? ` with ${result.errors.length} row error(s)` : ''}`
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
  @ApiOperation({ summary: 'Create a new product' })
  async create(@Body() productData: Partial<Product>) {
    return this.productsService.create(productData);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(@Param('id') id: string, @Body() productData: Partial<Product>) {
    return this.productsService.update(id, productData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  async remove(@Param('id') id: string) {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully' };
  }

  @Post('import/:vendorId')
  @ApiOperation({ summary: 'Import vendor products from Excel with images' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'images', maxCount: 50 }
  ]))
  async importProducts(
    @Param('vendorId') vendorId: string,
    @UploadedFiles() files: { file?: MulterFile[], images?: MulterFile[] },
  ) {
    if (!files.file || files.file.length === 0) {
      throw new BadRequestException('No Excel file uploaded');
    }

    try {
      const result = await this.productsExcelService.importFromExcelWithImages(
        vendorId,
        files.file[0].buffer,
        files.images || [],
      );
      
      // Cleanup orphan images right after import (regardless of success/failure)
      console.log('[Import] Cleaning up orphan images after import...');
      try {
        const cleanupResult = await this.productsService.cleanupOrphanImages(vendorId || undefined, true);
        console.log(`[Import] Orphan cleanup: ${cleanupResult.deleted} images deleted out of ${cleanupResult.orphans.length} orphans found`);
      } catch (cleanupError) {
        console.error('[Import] Failed to cleanup orphan images:', cleanupError);
      }
      
      const success = result.created > 0 || result.updated > 0;
      return {
        success,
        message: success
          ? `Import completed: ${result.created} created, ${result.updated} updated${result.errors.length > 0 ? ` with ${result.errors.length} row error(s)` : ''}`
          : result.errors.length > 0
            ? `Import failed — no products were created or updated`
            : 'Import failed: No products were created or updated. Check your Excel sheet names match category names.',
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

  @Post('import-zip/:vendorId')
  @ApiOperation({ summary: 'Import vendor products from ZIP (Excel + Images)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importProductsZip(
    @Param('vendorId') vendorId: string,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) {
      throw new BadRequestException('No ZIP file uploaded');
    }

    // Convert 'all' to null for platform vendor (admin imports)
    const actualVendorId = vendorId === 'all' ? null : vendorId;

    try {
      const result = await this.productsExcelService.importFromZip(
        actualVendorId,
        file.buffer,
      );
      
      // Cleanup orphan images right after import (regardless of success/failure)
      console.log('[Import] Cleaning up orphan images after import...');
      try {
        const cleanupResult = await this.productsService.cleanupOrphanImages(actualVendorId || undefined, true);
        console.log(`[Import] Orphan cleanup: ${cleanupResult.deleted} images deleted out of ${cleanupResult.orphans.length} orphans found`);
      } catch (cleanupError) {
        console.error('[Import] Failed to cleanup orphan images:', cleanupError);
      }
      
      const success = result.created > 0 || result.updated > 0;
      return {
        success,
        message: success
          ? `Import completed: ${result.created} created, ${result.updated} updated${result.errors.length > 0 ? ` with ${result.errors.length} row error(s)` : ''}`
          : result.errors.length > 0
            ? `Import failed — no products were created or updated`
            : 'Import failed: No products were created or updated. Check your Excel sheet names match category names.',
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

  @Post('admin/cleanup-orphan-images')
  @ApiOperation({ summary: 'Find and optionally delete orphan images from Cloudinary (Admin only)' })
  @ApiQuery({ name: 'delete', required: false, description: 'Set to "true" to actually delete orphans' })
  @ApiQuery({ name: 'vendorId', required: false, description: 'Filter by vendor ID (optional)' })
  async cleanupOrphanImages(
    @Query('delete') shouldDelete?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    try {
      const deleteOrphans = shouldDelete === 'true';
      const result = await this.productsService.cleanupOrphanImages(vendorId, deleteOrphans);
      
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
