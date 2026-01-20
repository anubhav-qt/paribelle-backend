import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VendorBlogPost } from './entities/vendor-blog-post.entity';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { PageStatus } from './entities/vendor-page.entity';

@Injectable()
export class VendorBlogPostsService {
  constructor(
    @InjectRepository(VendorBlogPost)
    private blogPostRepository: Repository<VendorBlogPost>,
  ) {}

  async create(vendorId: string, createBlogPostDto: CreateBlogPostDto): Promise<VendorBlogPost> {
    // Check if slug already exists for this vendor
    const existingPost = await this.blogPostRepository.findOne({
      where: { vendorId, slug: createBlogPostDto.slug },
    });

    if (existingPost) {
      throw new BadRequestException('A blog post with this slug already exists');
    }

    const blogPost = this.blogPostRepository.create({
      ...createBlogPostDto,
      vendorId,
      publishedAt: createBlogPostDto.status === PageStatus.PUBLISHED ? new Date() : null,
    });

    return this.blogPostRepository.save(blogPost);
  }

  async findAll(vendorId: string, includeUnpublished = false): Promise<VendorBlogPost[]> {
    const query = this.blogPostRepository
      .createQueryBuilder('post')
      .where('post.vendorId = :vendorId', { vendorId })
      .orderBy('post.createdAt', 'DESC');

    if (!includeUnpublished) {
      query.andWhere('post.status = :status', { status: PageStatus.PUBLISHED });
    }

    return query.getMany();
  }

  async findOne(vendorId: string, slug: string, includeUnpublished = false): Promise<VendorBlogPost> {
    const query = this.blogPostRepository
      .createQueryBuilder('post')
      .where('post.vendorId = :vendorId', { vendorId })
      .andWhere('post.slug = :slug', { slug });

    if (!includeUnpublished) {
      query.andWhere('post.status = :status', { status: PageStatus.PUBLISHED });
    }

    const post = await query.getOne();

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    // Increment view count
    await this.blogPostRepository.increment({ id: post.id }, 'viewCount', 1);
    post.viewCount += 1;

    return post;
  }

  async findById(id: string, vendorId?: string): Promise<VendorBlogPost> {
    const where: any = { id };
    if (vendorId) {
      where.vendorId = vendorId;
    }

    const post = await this.blogPostRepository.findOne({ where });

    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
  }

  async update(id: string, vendorId: string, updateBlogPostDto: UpdateBlogPostDto): Promise<VendorBlogPost> {
    const post = await this.findById(id, vendorId);

    // Check if slug is being changed and already exists
    if (updateBlogPostDto.slug && updateBlogPostDto.slug !== post.slug) {
      const existingPost = await this.blogPostRepository.findOne({
        where: { vendorId, slug: updateBlogPostDto.slug },
      });

      if (existingPost) {
        throw new BadRequestException('A blog post with this slug already exists');
      }
    }

    // Set publishedAt if status is changing to published
    if (updateBlogPostDto.status === PageStatus.PUBLISHED && post.status !== PageStatus.PUBLISHED) {
      post.publishedAt = new Date();
    }

    Object.assign(post, updateBlogPostDto);

    return this.blogPostRepository.save(post);
  }

  async remove(id: string, vendorId: string): Promise<void> {
    const post = await this.findById(id, vendorId);
    await this.blogPostRepository.remove(post);
  }

  async findByTag(vendorId: string, tag: string): Promise<VendorBlogPost[]> {
    return this.blogPostRepository
      .createQueryBuilder('post')
      .where('post.vendorId = :vendorId', { vendorId })
      .andWhere('post.status = :status', { status: PageStatus.PUBLISHED })
      .andWhere(':tag = ANY(post.tags)', { tag })
      .orderBy('post.publishedAt', 'DESC')
      .getMany();
  }

  async findRecent(vendorId: string, limit = 5): Promise<VendorBlogPost[]> {
    return this.blogPostRepository
      .createQueryBuilder('post')
      .where('post.vendorId = :vendorId', { vendorId })
      .andWhere('post.status = :status', { status: PageStatus.PUBLISHED })
      .orderBy('post.publishedAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
