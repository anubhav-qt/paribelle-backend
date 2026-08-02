import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Get all cities with sub-locations' })
  @ApiQuery({ name: 'search', required: false })
  async getAllCities(@Query('search') search?: string) {
    if (search) {
      return this.locationsService.searchCities(search);
    }
    return this.locationsService.getAllCities();
  }

  @Get('cities/:id')
  @ApiOperation({ summary: 'Get city by ID' })
  async getCityById(@Param('id') id: string) {
    return this.locationsService.getCityById(id);
  }

  @Get('cities/:cityId/sub-locations')
  @ApiOperation({ summary: 'Get sub-locations by city' })
  @ApiQuery({ name: 'search', required: false })
  async getSubLocationsByCity(
    @Param('cityId') cityId: string,
    @Query('search') search?: string,
  ) {
    if (search) {
      return this.locationsService.searchSubLocations(cityId, search);
    }
    return this.locationsService.getSubLocationsByCity(cityId);
  }

  @Post('cities')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new city' })
  async createCity(@Body() body: { name: string; state?: string; country?: string }) {
    return this.locationsService.createCity(body.name, body.state, body.country, true);
  }

  @Post('sub-locations')
  @AdminOnly()
  @ApiOperation({ summary: 'Create a new sub-location' })
  async createSubLocation(
    @Body() body: { name: string; cityId: string; zipCode?: string },
  ) {
    return this.locationsService.createSubLocation(
      body.name,
      body.cityId,
      body.zipCode,
    );
  }

  @Post('find-or-create-city')
  @AdminOnly()
  @ApiOperation({ summary: 'Find existing city or create new one' })
  async findOrCreateCity(
    @Body() body: { name: string; state?: string; country?: string },
  ) {
    return this.locationsService.findOrCreateCity(
      body.name,
      body.state,
      body.country,
    );
  }

  @Post('find-or-create-sub-location')
  @AdminOnly()
  @ApiOperation({ summary: 'Find existing sub-location or create new one' })
  async findOrCreateSubLocation(
    @Body() body: { name: string; cityId: string; zipCode?: string },
  ) {
    return this.locationsService.findOrCreateSubLocation(
      body.name,
      body.cityId,
      body.zipCode,
    );
  }

  @Delete('cities/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a city' })
  async deleteCity(@Param('id') id: string) {
    await this.locationsService.deleteCity(id);
    return { message: 'City deleted successfully' };
  }

  @Delete('sub-locations/:id')
  @AdminOnly()
  @ApiOperation({ summary: 'Delete a sub-location' })
  async deleteSubLocation(@Param('id') id: string) {
    await this.locationsService.deleteSubLocation(id);
    return { message: 'Sub-location deleted successfully' };
  }
}
