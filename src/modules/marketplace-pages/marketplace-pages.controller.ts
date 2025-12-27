import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketplacePagesService } from './marketplace-pages.service';
import { CreateMarketplacePageDto } from './dto/create-marketplace-page.dto';
import { UpdateMarketplacePageDto } from './dto/update-marketplace-page.dto';

@Controller('marketplace/pages')
export class MarketplacePagesController {
  constructor(
    private readonly marketplacePagesService: MarketplacePagesService,
  ) {}

  @Get()
  async findAll(@Query('includeUnpublished') includeUnpublished?: string) {
    return this.marketplacePagesService.findAll(
      includeUnpublished === 'true',
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.marketplacePagesService.findOne(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.marketplacePagesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDto: CreateMarketplacePageDto) {
    return this.marketplacePagesService.create(createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateMarketplacePageDto,
  ) {
    return this.marketplacePagesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.marketplacePagesService.remove(id);
    return { message: 'Page deleted successfully' };
  }
}
