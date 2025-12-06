import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { Category } from '../categories/category.entity';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private categoriesService: CategoriesService,
  ) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
    vendorId?: string,
    uncategorized?: boolean,
    cityId?: string,
    subLocationId?: string,
    productType?: string,
  ): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('vendor.locationCity', 'city')
      .leftJoinAndSelect('vendor.locationSubLocation', 'subLocation')
      .select([
        'product',
        'vendor.id',
        'vendor.storeName',
        'vendor.businessName',
        'vendor.subdomain',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
      ]);

    // Filter for uncategorized products (products with no categories)
    if (uncategorized) {
      queryBuilder
        .leftJoin('product.categories', 'category')
        .andWhere('category.id IS NULL')
        .andWhere('product.status = :activeStatus', { activeStatus: ProductStatus.ACTIVE });
    } else {
      queryBuilder
        .leftJoinAndSelect('product.categories', 'category')
        .addSelect(['category.id', 'category.name', 'category.slug']);
    }

    // Apply vendor filter
    if (vendorId) {
      queryBuilder.andWhere('product.vendorId = :vendorId', { vendorId });
    }

    // Apply city filter (include products without location)
    if (cityId) {
      queryBuilder.andWhere(
        '(vendor.cityId = :cityId OR vendor.cityId IS NULL)',
        { cityId }
      );
    }

    // Apply sub-location filter (include products without location)
    if (subLocationId) {
      queryBuilder.andWhere(
        '(vendor.subLocationId = :subLocationId OR vendor.subLocationId IS NULL)',
        { subLocationId }
      );
    }

    // Apply status filter (only if not already filtered by uncategorized)
    if (status && status !== 'all' && !uncategorized) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    // Apply search filter
    if (search) {
      queryBuilder.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply product type filter
    if (productType) {
      queryBuilder.andWhere('product.productType = :productType', { productType });
    }

    // Order by creation date
    queryBuilder.orderBy('product.createdAt', 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Get products
    const products = await queryBuilder.getMany();

    return {
      products,
      total,
      page,
      limit,
    };
  }

  async findByCategory(categoryId: string, filters?: Record<string, any>): Promise<Product[]> {
    // Get all descendant category IDs (including the category itself)
    const categoryIds = await this.getDescendantCategoryIds(categoryId);
    
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('vendor.locationCity', 'city')
      .leftJoinAndSelect('vendor.locationSubLocation', 'subLocation')
      .select([
        'product',
        'category.id',
        'category.name',
        'category.slug',
        'vendor.id',
        'vendor.storeName',
        'vendor.businessName',
        'vendor.subdomain',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
      ])
      .where('category.id IN (:...categoryIds)', { categoryIds })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE });

    // Apply vendor filter if provided
    if (filters?.vendorId) {
      queryBuilder.andWhere('product.vendorId = :filterVendorId', { filterVendorId: filters.vendorId });
    }

    // Apply location filters if provided (include products without location)
    if (filters?.cityId) {
      queryBuilder.andWhere(
        '(vendor.cityId = :cityId OR vendor.cityId IS NULL)',
        { cityId: filters.cityId }
      );
    }
    if (filters?.subLocationId) {
      queryBuilder.andWhere(
        '(vendor.subLocationId = :subLocationId OR vendor.subLocationId IS NULL)',
        { subLocationId: filters.subLocationId }
      );
    }

    // Apply dynamic filters based on product attributes
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        // Skip filters that are already handled above
        if (key === 'cityId' || key === 'subLocationId' || key === 'vendorId') {
          return;
        }
        
        // Handle productType filter
        if (key === 'productType' && value) {
          queryBuilder.andWhere('product.productType = :productType', { productType: value });
          return;
        }
        
        if (Array.isArray(value) && value.length > 0) {
          // For checkbox/multiselect filters
          queryBuilder.andWhere(
            `product.attributes->>'${key}' IN (:...${key}Values)`,
            { [`${key}Values`]: value }
          );
        } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // For range filters (e.g., price)
          if (key === 'price') {
            queryBuilder.andWhere(
              `product.price BETWEEN :${key}Min AND :${key}Max`,
              { [`${key}Min`]: value.min, [`${key}Max`]: value.max }
            );
          } else {
            queryBuilder.andWhere(
              `CAST(product.attributes->>'${key}' AS DECIMAL) BETWEEN :${key}Min AND :${key}Max`,
              { [`${key}Min`]: value.min, [`${key}Max`]: value.max }
            );
          }
        } else if (value) {
          // For single value filters
          queryBuilder.andWhere(
            `product.attributes->>'${key}' = :${key}Value`,
            { [`${key}Value`]: value }
          );
        }
      });
    }

    return queryBuilder.getMany();
  }

  /**
   * Get all descendant category IDs including the category itself
   * This allows showing products from child categories when viewing a parent
   */
  private async getDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const categoryIds: string[] = [categoryId];
    
    // Recursively find all child categories
    const findChildren = async (parentId: string) => {
      const children = await this.categoriesRepository.find({
        where: { parent: { id: parentId } },
      });
      
      for (const child of children) {
        categoryIds.push(child.id);
        await findChildren(child.id);
      }
    };
    
    await findChildren(categoryId);
    return categoryIds;
  }

  async findOne(id: string): Promise<Product | null> {
    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('vendor.locationCity', 'city')
      .leftJoinAndSelect('vendor.locationSubLocation', 'subLocation')
      .select([
        'product',
        'category.id',
        'category.name',
        'category.slug',
        'vendor.id',
        'vendor.storeName',
        'vendor.businessName',
        'vendor.subdomain',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
        'review.id',
        'review.rating',
        'review.comment',
        'review.createdAt',
      ])
      .where('product.id = :id', { id })
      .getOne();
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('vendor.locationCity', 'city')
      .leftJoinAndSelect('vendor.locationSubLocation', 'subLocation')
      .select([
        'product',
        'category.id',
        'category.name',
        'category.slug',
        'vendor.id',
        'vendor.storeName',
        'vendor.businessName',
        'vendor.subdomain',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
        'review.id',
        'review.rating',
        'review.comment',
        'review.createdAt',
      ])
      .where('product.slug = :slug', { slug })
      .getOne();
  }

  async create(productData: any): Promise<Product> {
    const { categoryIds, newFilterOptions, categoryId, ...data } = productData;
    
    // If categoryIds are provided, fetch the categories first
    let categories: Category[] = [];
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      categories = await this.categoriesRepository.find({
        where: { id: In(categoryIds) },
      });
      
      // Auto-initialize filters for categories that don't have them
      for (const categoryId of categoryIds) {
        await this.categoriesService.autoInitializeFilters(categoryId);
      }
    }
    
    // If new filter options are provided, add them to the category
    if (newFilterOptions && categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: categoryId },
      });
      
      if (category && category.filterConfig?.filters) {
        let updated = false;
        
        // Add new options to existing filters
        category.filterConfig.filters = category.filterConfig.filters.map((filter: any) => {
          if (newFilterOptions[filter.id]) {
            const newOption = newFilterOptions[filter.id];
            // Check if the option already exists
            const optionExists = filter.options?.some((opt: any) => opt.value === newOption.value);
            
            if (!optionExists) {
              filter.options = [...(filter.options || []), newOption];
              updated = true;
              console.log(`Added new ${filter.label} option: ${newOption.label}`);
            }
          }
          return filter;
        });
        
        // Save the updated category if changes were made
        if (updated) {
          await this.categoriesRepository.save(category);
        }
      }
    }
    
    // Create and save the product with categories
    const productToSave = {
      ...data,
      categories,
    };
    
    const product = this.productsRepository.create(productToSave);
    const savedProduct = await this.productsRepository.save(product);
    
    // Return the first item if it's an array, otherwise return as is
    return Array.isArray(savedProduct) ? savedProduct[0] : savedProduct;
  }

  async update(id: string, productData: any): Promise<Product | null> {
    const { categoryIds, ...data } = productData;
    
    // Update basic product data
    if (Object.keys(data).length > 0) {
      await this.productsRepository.update(id, data);
    }
    
    // If categoryIds are provided, update the categories relationship
    if (categoryIds && Array.isArray(categoryIds)) {
      const product = await this.productsRepository.findOne({
        where: { id },
        relations: ['categories'],
      });
      
      if (product) {
        // Fetch the new categories
        const categories = categoryIds.length > 0
          ? await this.categoriesRepository.find({
              where: { id: In(categoryIds) },
            })
          : [];
        
        // Update the categories relationship
        product.categories = categories;
        await this.productsRepository.save(product);
        
        // Auto-initialize filters for new categories
        for (const categoryId of categoryIds) {
          await this.categoriesService.autoInitializeFilters(categoryId);
        }
      }
    }
    
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.productsRepository.delete(id);
  }
}
