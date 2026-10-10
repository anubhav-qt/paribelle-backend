import { Controller, Get, Post, Put, Delete, Param, Body, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { VendorsService } from './vendors.service';
import { Vendor } from './vendor.entity';

@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all vendors' })
  async findAll() {
    return this.vendorsService.findAll();
  }

  @Get('root-store')
  @ApiOperation({
    summary:
      'Get the vendor that owns the root domain store, or null when the root aggregates every vendor',
  })
  async getRootStore() {
    return this.vendorsService.findRootStore();
  }

  @Get('by-slug/:slug/products')
  @ApiOperation({ summary: 'Get products for vendor by slug' })
  async getVendorProductsBySlug(@Param('slug') slug: string) {
    return this.vendorsService.getVendorProducts(slug);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Get products for vendor by ID' })
  async getVendorProducts(@Param('id') id: string) {
    // Prevent matching when id is "products" or other reserved words
    if (id === 'products' || id === 'by-slug') {
      return { statusCode: 404, message: 'Invalid vendor identifier' };
    }
    return this.vendorsService.getVendorProducts(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID or slug' })
  async findOne(@Param('id') id: string) {
    let vendor: Vendor | null = null;
    
    // Check if it's a UUID format first, to avoid PostgreSQL errors
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID) {
      // Try finding by UUID
      vendor = await this.vendorsService.findOne(id);
    } else {
      // Not a UUID, try finding by slug
      vendor = await this.vendorsService.findBySlug(id);
    }
    
    if (!vendor) {
      return { statusCode: 404, message: 'Vendor not found' };
    }
    return vendor;
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new vendor' })
  async create(@Body() vendorData: Partial<Vendor>) {
    return this.vendorsService.create(vendorData);
  }

  @Patch(':id')
  @AdminOnly()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vendor' })
  async update(@Param('id') id: string, @Body() vendorData: Partial<Vendor>) {
    try {
      console.log('Updating vendor:', id, 'with data:', vendorData);
      
      // Check if vendor exists first
      const existingVendor = await this.vendorsService.findOne(id);
      if (!existingVendor) {
        return { statusCode: 404, message: 'Vendor not found' };
      }

      // Handle location update separately if location data is provided
      if (vendorData.cityId || vendorData.subLocationId || (vendorData as any).pincode) {
        console.log('Updating vendor location...');
        await this.vendorsService.updateVendorLocation(id, {
          cityId: vendorData.cityId,
          subLocationId: vendorData.subLocationId,
          pincode: (vendorData as any).pincode,
          address: vendorData.address,
        });
        // Remove location fields from vendorData before regular update
        const { cityId, subLocationId, address, ...otherData } = vendorData;
        delete (otherData as any).pincode;
        
        if (Object.keys(otherData).length > 0) {
          console.log('Updating vendor other data:', otherData);
          const result = await this.vendorsService.update(id, otherData);
          console.log('Update result:', result);
        }
      } else {
        // No location data, just update vendor fields
        console.log('Updating vendor data without location...');
        const result = await this.vendorsService.update(id, vendorData);
        console.log('Update result:', result);
      }
      
      // Fetch and return the updated vendor
      const updated = await this.vendorsService.findOne(id);
      console.log('Vendor updated successfully, returning:', updated ? 'vendor object' : 'null');
      
      if (!updated) {
        return { statusCode: 500, message: 'Failed to retrieve updated vendor' };
      }
      
      return {
        statusCode: 200,
        message: 'Vendor updated successfully',
        data: updated,
      };
    } catch (error) {
      console.error('Error updating vendor:', error);
      return { 
        statusCode: 500, 
        message: error.message || 'Failed to update vendor',
        error: error.toString()
      };
    }
  }

  @Delete(':id')
  @AdminOnly(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a vendor' })
  async remove(@Param('id') id: string) {
    await this.vendorsService.remove(id);
    return { message: 'Vendor deleted successfully' };
  }

  @Put(':id/hero-banners')
  @AdminOnly()
  @ApiOperation({ summary: 'Update vendor hero banners' })
  async updateHeroBanners(
    @Param('id') id: string,
    @Body() body: { heroBanners: Array<any> }
  ) {
    try {
      await this.vendorsService.update(id, { heroBanners: body.heroBanners });
      const updated = await this.vendorsService.findOne(id);
      return updated;
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message || 'Failed to update hero banners',
        error: error.toString()
      };
    }
  }

  @Get(':id/hero-banners')
  @ApiOperation({ summary: 'Get vendor hero banners' })
  async getHeroBanners(@Param('id') id: string) {
    const vendor = await this.vendorsService.findOne(id);
    if (!vendor) {
      return { statusCode: 404, message: 'Vendor not found' };
    }
    return { heroBanners: vendor.heroBanners || [] };
  }

  @Put(':id/theme')
  @AdminOnly()
  @ApiOperation({ summary: 'Update vendor theme configuration' })
  async updateTheme(
    @Param('id') id: string,
    @Body() body: { themeConfig: any }
  ) {
    try {
      await this.vendorsService.update(id, { themeConfig: body.themeConfig });
      const updated = await this.vendorsService.findOne(id);
      return updated;
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message || 'Failed to update theme',
        error: error.toString()
      };
    }
  }

  @Get(':id/theme')
  @ApiOperation({ summary: 'Get vendor theme configuration' })
  async getTheme(@Param('id') id: string) {
    const vendor = await this.vendorsService.findOne(id);
    if (!vendor) {
      return { statusCode: 404, message: 'Vendor not found' };
    }
    return { themeConfig: vendor.themeConfig || {} };
  }

  @Patch(':id/about')
  @AdminOnly()
  @ApiOperation({ summary: 'Update vendor about section' })
  async updateAbout(
    @Param('id') id: string,
    @Body() body: { aboutContent?: string; aboutImages?: string[] }
  ) {
    try {
      await this.vendorsService.update(id, body);
      const updated = await this.vendorsService.findOne(id);
      return updated;
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message || 'Failed to update about section',
        error: error.toString()
      };
    }
  }

  @Patch(':id/seo')
  @AdminOnly()
  @ApiOperation({ summary: 'Update vendor SEO settings' })
  async updateSeo(
    @Param('id') id: string,
    @Body() body: { metaTitle?: string; metaDescription?: string; metaKeywords?: string }
  ) {
    try {
      await this.vendorsService.update(id, body);
      const updated = await this.vendorsService.findOne(id);
      return updated;
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message || 'Failed to update SEO settings',
        error: error.toString()
      };
    }
  }

  @Patch(':id/policies')
  @AdminOnly()
  @ApiOperation({ summary: 'Update vendor return and cancellation policies' })
  async updatePolicies(
    @Param('id') id: string,
    @Body() body: {
      returnPolicy?: { enabled: boolean; days?: number; text: string };
      cancellationPolicy?: { enabled: boolean; text: string };
    }
  ) {
    try {
      await this.vendorsService.update(id, {
        returnPolicy: body.returnPolicy,
        cancellationPolicy: body.cancellationPolicy,
      });
      const updated = await this.vendorsService.findOne(id);
      return updated;
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message || 'Failed to update policies',
        error: error.toString()
      };
    }
  }
}
