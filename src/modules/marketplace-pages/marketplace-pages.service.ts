import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplacePage, PageStatus } from './entities/marketplace-page.entity';
import { CreateMarketplacePageDto } from './dto/create-marketplace-page.dto';
import { UpdateMarketplacePageDto } from './dto/update-marketplace-page.dto';

@Injectable()
export class MarketplacePagesService {
  constructor(
    @InjectRepository(MarketplacePage)
    private readonly marketplacePageRepository: Repository<MarketplacePage>,
  ) {}

  async findAll(includeUnpublished = false): Promise<MarketplacePage[]> {
    const query =
      this.marketplacePageRepository.createQueryBuilder('page');

    if (!includeUnpublished) {
      query.where('page.status = :status', { status: PageStatus.PUBLISHED });
    }

    query.orderBy('page.updatedAt', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<MarketplacePage> {
    const page = await this.marketplacePageRepository.findOne({
      where: { id },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async findBySlug(slug: string): Promise<MarketplacePage> {
    const page = await this.marketplacePageRepository.findOne({
      where: { slug, status: PageStatus.PUBLISHED },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async create(
    createDto: CreateMarketplacePageDto,
  ): Promise<MarketplacePage> {
    // Check for duplicate slug
    const existing = await this.marketplacePageRepository.findOne({
      where: { slug: createDto.slug },
    });

    if (existing) {
      throw new BadRequestException('A page with this slug already exists');
    }

    const page = this.marketplacePageRepository.create(createDto);

    if (createDto.status === PageStatus.PUBLISHED) {
      page.publishedAt = new Date();
    }

    return this.marketplacePageRepository.save(page);
  }

  async update(
    id: string,
    updateDto: UpdateMarketplacePageDto,
  ): Promise<MarketplacePage> {
    const page = await this.findOne(id);

    // Check slug uniqueness if changed
    if (updateDto.slug && updateDto.slug !== page.slug) {
      const existing = await this.marketplacePageRepository.findOne({
        where: { slug: updateDto.slug },
      });

      if (existing) {
        throw new BadRequestException('A page with this slug already exists');
      }
    }

    // Update publishedAt if status changes to published
    if (
      updateDto.status === PageStatus.PUBLISHED &&
      page.status !== PageStatus.PUBLISHED
    ) {
      page.publishedAt = new Date();
    }

    Object.assign(page, updateDto);
    return this.marketplacePageRepository.save(page);
  }

  async remove(id: string): Promise<void> {
    const page = await this.findOne(id);
    await this.marketplacePageRepository.remove(page);
  }
}
