import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { CategoriesService } from '../categories/categories.service';
import { FileCleanupService } from '../../common/services/file-cleanup.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { MarketplaceGateway } from '../stock/stock.gateway';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantsRepository: Repository<ProductVariant>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private categoriesService: CategoriesService,
    private fileCleanupService: FileCleanupService,
    private cloudinaryService: CloudinaryService,
    private marketplaceGateway: MarketplaceGateway,
    private configService: ConfigService,
  ) {}

  /**
   * Validate that image URLs are not from external stock photo services
   * Only allowed in development/testing environments
   */
  private validateImageUrls(imageUrls: string | string[]): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    // Skip validation in development
    if (!isProduction) {
      return;
    }

    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    
    const externalStockSites = [
      'unsplash.com',
      'images.unsplash.com',
      'source.unsplash.com',
      'picsum.photos',
      'loremflickr.com',
    ];

    for (const url of urls) {
      if (!url) continue;
      
      const isExternalStock = externalStockSites.some(site => url.includes(site));
      
      if (isExternalStock) {
        throw new BadRequestException(
          'Stock photos are not allowed in production. Please upload your own product images using the image upload feature.'
        );
      }
    }
  }

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
    includeUnverifiedVendors: boolean = false, // Only show KYC approved vendors by default
  ): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('vendor.locationCity', 'city')
      .leftJoinAndSelect('vendor.locationSubLocation', 'subLocation')
      .leftJoinAndSelect('product.productVariants', 'productVariants')
      .select([
        'product',
        'vendor.id',
        'vendor.storeName',
        'vendor.businessName',
        'vendor.subdomain',
        'vendor.kycStatus',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
        'productVariants',
      ]);

    // CRITICAL: Filter out products from unverified vendors for public listings
    // When vendorId is provided (vendor viewing their own products), skip KYC check
    // When includeUnverifiedVendors=true (admin panel), skip KYC check
    // Otherwise, only show KYC approved vendors
    if (!includeUnverifiedVendors && !vendorId) {
      queryBuilder.andWhere('vendor.kycStatus = :kycStatus', { kycStatus: 'approved' });
    }

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
        'vendor.kycStatus',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
      ])
      .where('category.id IN (:...categoryIds)', { categoryIds })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE });

    // CRITICAL: Only show products from KYC approved vendors (unless explicitly filtering for a specific vendor)
    if (!filters?.vendorId) {
      queryBuilder.andWhere('vendor.kycStatus = :kycStatus', { kycStatus: 'approved' });
    }

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
    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('product.variations', 'variations')
      .leftJoinAndSelect('product.parentProduct', 'parentProduct')
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
        'vendor.kycStatus',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
        'review.id',
        'review.rating',
        'review.comment',
        'review.createdAt',
        'variations',
        'parentProduct.id',
        'parentProduct.name',
        'parentProduct.slug',
      ])
      .where('product.id = :id', { id })
      .andWhere('vendor.kycStatus = :kycStatus', { kycStatus: 'approved' }) // Only show products from verified vendors
      .getOne();
    
    // If product has variants, fetch them
    if (product && product.hasVariants) {
      const variants = await this.getProductVariants(product.id);
      (product as any).productVariants = variants;
    }
    
    return product;
  }

  /**
   * Get all product variants for a product
   */
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return this.productVariantsRepository.find({
      where: { productId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get all variations for a parent product
   */
  async findVariations(parentProductId: string): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.categories', 'categories')
      .where('product.parentProductId = :parentProductId', { parentProductId })
      .andWhere('vendor.kycStatus = :kycStatus', { kycStatus: 'approved' }) // Only show variations from verified vendors
      .orderBy('product.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Find a specific variation by parent product ID and variation attributes
   */
  async findVariationByAttributes(
    parentProductId: string,
    attributes: Record<string, string>,
  ): Promise<Product | null> {
    const variations = await this.findVariations(parentProductId);
    
    return variations.find((variation) => {
      if (!variation.variationAttributes) return false;
      
      // Check if all attributes match
      return Object.entries(attributes).every(
        ([key, value]) => variation.variationAttributes[key] === value,
      );
    }) || null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const product = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('product.variations', 'variations')
      .leftJoinAndSelect('product.parentProduct', 'parentProduct')
      .leftJoinAndSelect('product.productVariants', 'productVariants')
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
        'vendor.kycStatus',
        'city.id',
        'city.name',
        'subLocation.id',
        'subLocation.name',
        'review.id',
        'review.rating',
        'review.comment',
        'review.createdAt',
        'variations',
        'parentProduct.id',
        'parentProduct.name',
        'parentProduct.slug',
        'productVariants',
      ])
      .where('product.slug = :slug', { slug })
      .andWhere('vendor.kycStatus = :kycStatus', { kycStatus: 'approved' }) // Only show products from verified vendors
      .getOne();
    
    // If product has variants, fetch them and generate variantOptions
    if (product && product.hasVariants) {
      const variants = await this.getProductVariants(product.id);
      (product as any).productVariants = variants;
      
      // Generate variantOptions from variants for frontend selector
      if (variants && variants.length > 0) {
        const attributeKeys = new Set<string>();
        variants.forEach(variant => {
          if (variant.variantAttributes) {
            Object.keys(variant.variantAttributes).forEach(key => attributeKeys.add(key));
          }
        });
        
        const variantOptions: any[] = [];
        attributeKeys.forEach(key => {
          const values = new Set<string>();
          variants.forEach(variant => {
            if (variant.variantAttributes && variant.variantAttributes[key]) {
              values.add(variant.variantAttributes[key]);
            }
          });
          variantOptions.push({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            values: Array.from(values)
          });
        });
        
        (product as any).variantOptions = variantOptions;
      }
    }
    
    return product;
  }

  async create(productData: any): Promise<Product> {
    const { categoryIds, newFilterOptions, categoryId, variations, variants, variantOptions, ...data } = productData;
    
    // Platform vendor ID for products created by super admin
    const PLATFORM_VENDOR_ID = '00000000-0000-0000-0000-000000000001';
    
    // CRITICAL: Validate vendor can create products
    // Vendors must complete setup and KYC before adding products
    // Skip validation for platform vendor (super admin products)
    if (data.vendorId && data.vendorId !== PLATFORM_VENDOR_ID) {
      const vendor = await this.vendorsRepository.findOne({
        where: { id: data.vendorId },
      });
      
      if (!vendor) {
        throw new BadRequestException('Vendor not found');
      }
      
      // Check if vendor has completed basic setup
      if (!vendor.storeName || !vendor.contactEmail || !vendor.contactPhone) {
        throw new BadRequestException('Please complete your store setup before adding products. Go to Vendor Settings to complete your profile.');
      }
      
      // Check KYC status
      if (vendor.kycStatus !== 'approved') {
        throw new BadRequestException(`KYC verification required. Your KYC status is: ${vendor.kycStatus}. Please complete KYC verification before adding products.`);
      }
    }
    
    // Ensure GST fields have default values if not provided
    if (!data.priceType) {
      data.priceType = 'mrp_with_gst'; // Default to tax-inclusive pricing
    }
    if (!data.gstRate && data.gstRate !== 0) {
      data.gstRate = 18.00; // Default to 18% GST
    }
    
    // Validate image URLs in production
    if (data.images && Array.isArray(data.images)) {
      this.validateImageUrls(data.images);
    }
    if (data.featuredImage) {
      this.validateImageUrls(data.featuredImage);
    }
    
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
      hasVariants: variantOptions && Array.isArray(variantOptions) && variantOptions.length > 0,
      variantOptions: variantOptions || null,
    };
    
    const product = this.productsRepository.create(productToSave);
    const savedProduct = await this.productsRepository.save(product);
    const parentProduct = Array.isArray(savedProduct) ? savedProduct[0] : savedProduct;

    // If variants are provided, create ProductVariant entries
    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const variant of variants) {
        const productVariant = this.productVariantsRepository.create({
          productId: parentProduct.id,
          variantAttributes: variant.attributes,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stockQuantity: variant.stock,
          isActive: true,
        });
        
        await this.productVariantsRepository.save(productVariant);
      }
    }
    
    return parentProduct;
  }

  async update(id: string, productData: any): Promise<Product | null> {
    const { 
      categoryIds, 
      variations, 
      vendor, 
      reviews, 
      parentProduct,
      productVariants,
      variantOptions,
      ...data 
    } = productData;
    
    // Ensure GST fields have default values if explicitly set to null/undefined
    // Don't override existing values if fields are not in the update payload
    if (data.hasOwnProperty('priceType') && !data.priceType) {
      data.priceType = 'mrp_with_gst';
    }
    if (data.hasOwnProperty('gstRate') && !data.gstRate && data.gstRate !== 0) {
      data.gstRate = 18.00;
    }
    
    // Validate image URLs in production
    if (data.images && Array.isArray(data.images)) {
      this.validateImageUrls(data.images);
    }
    if (data.featuredImage) {
      this.validateImageUrls(data.featuredImage);
    }
    
    // Update basic product data (excluding relation fields)
    if (Object.keys(data).length > 0) {
      await this.productsRepository.update(id, data);
    }
    
    // Update product variants if provided
    if (productVariants && Array.isArray(productVariants) && productVariants.length > 0) {
      for (const variantData of productVariants) {
        if (variantData.id) {
          // Update existing variant
          await this.productVariantsRepository.update(variantData.id, {
            price: variantData.price,
            compareAtPrice: variantData.compareAtPrice,
            stockQuantity: variantData.stockQuantity,
          });
        }
      }
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
    // Check if product has associated orders
    const orderItemsCount = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('order_items', 'orderItem', 'orderItem.product_id = product.id')
      .where('product.id = :id', { id })
      .select('COUNT(orderItem.id)', 'count')
      .getRawOne();

    if (orderItemsCount && parseInt(orderItemsCount.count) > 0) {
      // Product has been ordered - archive it instead of deleting
      await this.productsRepository.update(id, { status: ProductStatus.ARCHIVED });
      return;
    }

    // Get product with variants to delete associated images
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['productVariants'],
    });

    if (product) {
      // Delete product images
      await this.fileCleanupService.deleteEntityImages(product, [
        'images',
        'featuredImage',
      ]);

      // Delete variant images
      if (product.productVariants && product.productVariants.length > 0) {
        for (const variant of product.productVariants) {
          await this.fileCleanupService.deleteEntityImages(variant, ['images']);
        }
      }
    }

    // Delete product from database (cascades to variants)
    await this.productsRepository.delete(id);
  }

  /**
   * Find and optionally delete orphan images from Cloudinary
   * Orphan images are those that exist in Cloudinary but are not referenced by any product
   * @param vendorId - Optional vendor ID to filter products
   * @param deleteOrphans - If true, delete orphan images; if false, just return them
   * @returns Object with cleanup results
   */
  async cleanupOrphanImages(
    vendorId?: string,
    deleteOrphans: boolean = false,
  ): Promise<{
    total: number;
    orphans: string[];
    deleted: number;
    errors: string[];
  }> {
    // Get all products (optionally filtered by vendor)
    const whereCondition = vendorId ? { vendorId } : {};
    const products = await this.productsRepository.find({
      where: whereCondition,
      relations: ['productVariants'],
    });

    // Collect all image URLs from products and variants
    const referencedUrls: string[] = [];

    products.forEach(product => {
      // Add product images
      if (product.images && Array.isArray(product.images)) {
        referencedUrls.push(...product.images.filter(url => url));
      }
      if (product.featuredImage) {
        referencedUrls.push(product.featuredImage);
      }

      // Add variant images
      if (product.productVariants && product.productVariants.length > 0) {
        product.productVariants.forEach(variant => {
          if (variant.images && Array.isArray(variant.images)) {
            referencedUrls.push(...variant.images.filter(url => url));
          }
        });
      }
    });

    // Filter to only Cloudinary URLs
    const cloudinaryUrls = referencedUrls.filter(url =>
      url.startsWith('https://res.cloudinary.com'),
    );

    console.log(`Found ${cloudinaryUrls.length} Cloudinary URLs referenced by ${products.length} products`);

    // Determine which folder to check based on vendor filter
    const folder = vendorId
      ? `marketplace/products/${vendorId}`
      : 'marketplace/products';

    // Use CloudinaryService to find and optionally delete orphans
    return this.cloudinaryService.cleanupOrphanImages(
      folder,
      cloudinaryUrls,
      deleteOrphans,
    );
  }
}
