import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product, ProductStatus } from '../products/product.entity';
import { Category } from '../categories/category.entity';
import { Cache } from 'cache-manager';
import { CACHE_KEYS, CACHE_TTL } from '../cache/cache.constants';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getSuggestions(query: string) {
    const cacheKey = CACHE_KEYS.SEARCH_SUGGESTIONS(query.toLowerCase());
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached as any;
    }

    // ILIKE wildcards in the query are matched literally.
    const searchPattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

    const [products, categories] = await Promise.all([
      this.productRepository.find({
        where: { name: ILike(searchPattern), status: ProductStatus.ACTIVE },
        take: 5,
        select: ['id', 'name', 'slug', 'featuredImage', 'price'],
        order: { name: 'ASC' },
      }),
      this.categoryRepository.find({
        where: { name: ILike(searchPattern), isActive: true },
        take: 5,
        select: ['id', 'name', 'slug'],
        order: { name: 'ASC' },
      }),
    ]);

    const result = { products, categories };
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  }
}
