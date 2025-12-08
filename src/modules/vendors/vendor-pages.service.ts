import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorPage, PageStatus } from './entities/vendor-page.entity';
import { CreateVendorPageDto } from './dto/create-vendor-page.dto';
import { UpdateVendorPageDto } from './dto/update-vendor-page.dto';

@Injectable()
export class VendorPagesService {
  constructor(
    @InjectRepository(VendorPage)
    private readonly vendorPageRepository: Repository<VendorPage>,
  ) {}

  async findAll(vendorId: string, includeUnpublished = false): Promise<VendorPage[]> {
    const query = this.vendorPageRepository
      .createQueryBuilder('page')
      .where('page.vendorId = :vendorId', { vendorId })
      .orderBy('page.order', 'ASC');

    if (!includeUnpublished) {
      query.andWhere('page.status = :status', { status: PageStatus.PUBLISHED });
    }

    return query.getMany();
  }

  async findOne(id: string, vendorId: string): Promise<VendorPage> {
    const page = await this.vendorPageRepository.findOne({
      where: { id, vendorId },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async findBySlug(slug: string, vendorId: string): Promise<VendorPage> {
    const page = await this.vendorPageRepository.findOne({
      where: { slug, vendorId, status: PageStatus.PUBLISHED },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }

  async create(vendorId: string, createDto: CreateVendorPageDto): Promise<VendorPage> {
    // Check for duplicate slug
    const existing = await this.vendorPageRepository.findOne({
      where: { slug: createDto.slug, vendorId },
    });

    if (existing) {
      throw new BadRequestException('A page with this slug already exists');
    }

    const page = this.vendorPageRepository.create({
      ...createDto,
      vendorId,
    });

    return this.vendorPageRepository.save(page);
  }

  async update(id: string, vendorId: string, updateDto: UpdateVendorPageDto): Promise<VendorPage> {
    const page = await this.findOne(id, vendorId);

    // Check slug uniqueness if changed
    if (updateDto.slug && updateDto.slug !== page.slug) {
      const existing = await this.vendorPageRepository.findOne({
        where: { slug: updateDto.slug, vendorId },
      });

      if (existing) {
        throw new BadRequestException('A page with this slug already exists');
      }
    }

    Object.assign(page, updateDto);
    return this.vendorPageRepository.save(page);
  }

  async publish(id: string, vendorId: string): Promise<VendorPage> {
    const page = await this.findOne(id, vendorId);
    page.status = PageStatus.PUBLISHED;
    page.publishedAt = new Date();
    return this.vendorPageRepository.save(page);
  }

  async unpublish(id: string, vendorId: string): Promise<VendorPage> {
    const page = await this.findOne(id, vendorId);
    page.status = PageStatus.DRAFT;
    return this.vendorPageRepository.save(page);
  }

  async remove(id: string, vendorId: string): Promise<void> {
    const page = await this.findOne(id, vendorId);
    await this.vendorPageRepository.remove(page);
  }

  async reorder(vendorId: string, pageOrders: { id: string; order: number }[]): Promise<void> {
    for (const { id, order } of pageOrders) {
      await this.vendorPageRepository.update({ id, vendorId }, { order });
    }
  }
}
