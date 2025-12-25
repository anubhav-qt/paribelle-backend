import { Controller, Get, Post, Put, Delete, Param, Body, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Create a new vendor' })
  async create(@Body() vendorData: Partial<Vendor>) {
    return this.vendorsService.create(vendorData);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  async update(@Param('id') id: string, @Body() vendorData: Partial<Vendor>) {
    try {
      // Handle location update separately if location data is provided
      if (vendorData.cityId || vendorData.subLocationId || (vendorData as any).pincode) {
        await this.vendorsService.updateVendorLocation(id, {
          cityId: vendorData.cityId,
          subLocationId: vendorData.subLocationId,
          pincode: (vendorData as any).pincode,
          address: vendorData.address,
        });
        // Remove location fields from vendorData before regular update
        const { cityId, subLocationId, address, ...otherData } = vendorData;
        if (Object.keys(otherData).length > 0) {
          await this.vendorsService.update(id, otherData);
        }
      } else {
        await this.vendorsService.update(id, vendorData);
      }
      
      const updated = await this.vendorsService.findOne(id);
      if (!updated) {
        return { statusCode: 404, message: 'Vendor not found' };
      }
      return updated;
    } catch (error) {
      return { 
        statusCode: 500, 
        message: error.message || 'Failed to update vendor',
        error: error.toString()
      };
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vendor' })
  async remove(@Param('id') id: string) {
    await this.vendorsService.remove(id);
    return { message: 'Vendor deleted successfully' };
  }

  @Put(':id/hero-banners')
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
