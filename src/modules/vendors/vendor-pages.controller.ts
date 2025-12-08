import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VendorPagesService } from './vendor-pages.service';
import { CreateVendorPageDto } from './dto/create-vendor-page.dto';
import { UpdateVendorPageDto } from './dto/update-vendor-page.dto';

@Controller('vendors/:vendorId/pages')
export class VendorPagesController {
  constructor(private readonly vendorPagesService: VendorPagesService) {}

  @Get()
  async findAll(
    @Param('vendorId') vendorId: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    return this.vendorPagesService.findAll(
      vendorId,
      includeUnpublished === 'true',
    );
  }

  @Get(':id')
  async findOne(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
  ) {
    return this.vendorPagesService.findOne(id, vendorId);
  }

  @Get('slug/:slug')
  async findBySlug(
    @Param('vendorId') vendorId: string,
    @Param('slug') slug: string,
  ) {
    return this.vendorPagesService.findBySlug(slug, vendorId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('vendorId') vendorId: string,
    @Body() createDto: CreateVendorPageDto,
  ) {
    return this.vendorPagesService.create(vendorId, createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateVendorPageDto,
  ) {
    return this.vendorPagesService.update(id, vendorId, updateDto);
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
  ) {
    return this.vendorPagesService.publish(id, vendorId);
  }

  @Patch(':id/unpublish')
  @UseGuards(JwtAuthGuard)
  async unpublish(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
  ) {
    return this.vendorPagesService.unpublish(id, vendorId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
  ) {
    await this.vendorPagesService.remove(id, vendorId);
    return { message: 'Page deleted successfully' };
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  async reorder(
    @Param('vendorId') vendorId: string,
    @Body() body: { pageOrders: { id: string; order: number }[] },
  ) {
    await this.vendorPagesService.reorder(vendorId, body.pageOrders);
    return { message: 'Pages reordered successfully' };
  }
}
