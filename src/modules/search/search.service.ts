import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product, ProductStatus } from '../products/product.entity';
import { Category } from '../categories/category.entity';
import { Vendor, VendorStatus } from '../vendors/vendor.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
  ) {}

  async getSuggestions(query: string) {
    const searchPattern = `%${query}%`;

    // Run all queries in parallel for better performance
    const [products, categories, vendors] = await Promise.all([
      // Search products
      this.productRepository.find({
        where: {
          name: ILike(searchPattern),
          status: ProductStatus.ACTIVE,
        },
        take: 5,
        select: ['id', 'name', 'slug', 'featuredImage', 'price'],
        order: { name: 'ASC' },
      }),

      // Search categories
      this.categoryRepository.find({
        where: {
          name: ILike(searchPattern),
        },
        take: 3,
        select: ['id', 'name', 'slug'],
        order: { name: 'ASC' },
      }),

      // Search vendors
      this.vendorRepository.find({
        where: {
          storeName: ILike(searchPattern),
          status: VendorStatus.ACTIVE,
        },
        take: 3,
        select: ['id', 'storeName', 'slug'],
        order: { storeName: 'ASC' },
      }),
    ]);

    return {
      products,
      categories,
      vendors,
    };
  }
}
