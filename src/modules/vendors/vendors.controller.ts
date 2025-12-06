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

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get vendor by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.vendorsService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  async findOne(@Param('id') id: string) {
    const vendor = await this.vendorsService.findOne(id);
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
}
