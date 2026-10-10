import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminOnly, isStoreAdmin } from '../../common/decorators/admin-only.decorator';
import { MarketplacePagesService } from './marketplace-pages.service';
import { CreateMarketplacePageDto } from './dto/create-marketplace-page.dto';
import { UpdateMarketplacePageDto } from './dto/update-marketplace-page.dto';
import { PageType } from './entities/marketplace-page.entity';

@Controller('marketplace/pages')
export class MarketplacePagesController {
  constructor(
    private readonly marketplacePagesService: MarketplacePagesService,
  ) {}

  /** Published pages; admins may add `includeUnpublished=true` for drafts. */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Request() req,
    @Query('includeUnpublished') includeUnpublished?: string,
    @Query('pageType') pageType?: string,
  ) {
    return this.marketplacePagesService.findAll({
      includeUnpublished: includeUnpublished === 'true' && isStoreAdmin(req.user),
      pageType: Object.values(PageType).includes(pageType as PageType) ? (pageType as PageType) : undefined,
    });
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.marketplacePagesService.findBySlug(slug);
  }

  /** Any page by id, drafts included: the admin editor. */
  @Get(':id')
  @AdminOnly()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketplacePagesService.findOne(id);
  }

  @Post()
  @AdminOnly()
  create(@Body() createDto: CreateMarketplacePageDto) {
    return this.marketplacePagesService.create(createDto);
  }

  @Put(':id')
  @AdminOnly()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMarketplacePageDto,
  ) {
    return this.marketplacePagesService.update(id, updateDto);
  }

  @Delete(':id')
  @AdminOnly()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.marketplacePagesService.remove(id);
    return { message: 'Page deleted successfully' };
  }
}
