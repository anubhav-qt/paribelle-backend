import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { STORE_ID } from '../store/store.constants';
import { CategoriesService } from '../categories/categories.service';
import { FileCleanupService } from '../../common/services/file-cleanup.service';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import { ConfigService } from '@nestjs/config';
import { gstRateFor, gstSlugFrom } from './gst-rates';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantsRepository: Repository<ProductVariant>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private categoriesService: CategoriesService,
    private fileCleanupService: FileCleanupService,
    private cloudinaryService: CloudinaryService,
    private configService: ConfigService,
  ) {}

  /**
   * Counts across the *entire* catalogue, not one page of it. The admin
   * dashboard used to compute "Active" / "Low Stock" / "Out of Stock" by
   * filtering whatever 20-row page happened to be loaded, so those tiles could
   * never read above the page size no matter how many products actually
   * qualified — reported as "we imported 147 products, only 20 show active".
   * One grouped query avoids ever needing to load the products themselves.
   */
  async getAdminStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    archived: number;
    lowStock: number;
    outOfStock: number;
  }> {
    const statusRows: Array<{ status: string; count: string }> = await this.productsRepository
      .createQueryBuilder('product')
      .select('product.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('product.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of statusRows) {
      const count = parseInt(row.count, 10);
      byStatus[row.status] = count;
      total += count;
    }

    // "Out of stock" is a real status value, but a product can also carry
    // zero stock while still marked `active` (stock ran out after listing) —
    // count both by quantity rather than trusting the status column alone.
    const [lowStockRow, outOfStockRow] = await Promise.all([
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.stockQuantity > 0 AND product.stockQuantity < 10')
        .getCount(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.stockQuantity = 0')
        .getCount(),
    ]);

    return {
      total,
      active: byStatus[ProductStatus.ACTIVE] || 0,
      draft: byStatus[ProductStatus.DRAFT] || 0,
      archived: byStatus[ProductStatus.ARCHIVED] || 0,
      lowStock: lowStockRow,
      outOfStock: outOfStockRow,
    };
  }

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
    uncategorized?: boolean,
    productType?: string,
    stock?: 'low' | 'out', // Mirrors the low/out-of-stock definition used by getAdminStats
  ): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.productVariants', 'productVariants');

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

    // Apply stock filter — same thresholds as getAdminStats above (low: 0 < qty < 10, out: qty = 0)
    if (stock === 'low') {
      queryBuilder.andWhere('product.stockQuantity > 0 AND product.stockQuantity < 10');
    } else if (stock === 'out') {
      queryBuilder.andWhere('product.stockQuantity = 0');
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
    products.forEach((product) => this.attachDerivedAttributes(product));

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
      .leftJoinAndSelect('product.productVariants', 'productVariants')
      .select(['product', 'category.id', 'category.name', 'category.slug', 'productVariants'])
      .where('category.id IN (:...categoryIds)', { categoryIds })
      .andWhere('product.status = :status', { status: ProductStatus.ACTIVE });

    // Attribute filters. A product matches when at least one of its variants
    // carries the value, because that is where attributes live — the shopper
    // asking for "Size: M" wants the products they can actually buy in M, not
    // the ones whose catalogue entry once mentioned M.
    if (filters) {
      let clauseIndex = 0;

      Object.entries(filters).forEach(([key, value]) => {
        // Marketplace-era keys an old link may still carry.
        if (key === 'cityId' || key === 'subLocationId' || key === 'vendorId') {
          return;
        }

        // Handle productType filter
        if (key === 'productType' && value) {
          queryBuilder.andWhere('product.productType = :productType', { productType: value });
          return;
        }

        // `price` is a column, not an attribute.
        if (key === 'price' && value && typeof value === 'object' &&
            value.min !== undefined && value.max !== undefined) {
          queryBuilder.andWhere('product.price BETWEEN :priceMin AND :priceMax', {
            priceMin: value.min,
            priceMax: value.max,
          });
          return;
        }

        // Parameterised throughout: filter keys arrive straight from the query
        // string, and the old code interpolated them into the SQL text.
        const p = `attr${clauseIndex++}`;

        if (Array.isArray(value) && value.length > 0) {
          queryBuilder.andWhere(
            this.variantAttributeExists(`LOWER(fv.attr_value) IN (:...${p}Values)`, p),
            {
              [`${p}Key`]: key,
              [`${p}Values`]: value.map((v) => String(v).toLowerCase()),
            },
          );
        } else if (value && typeof value === 'object' &&
                   value.min !== undefined && value.max !== undefined) {
          queryBuilder.andWhere(
            this.variantAttributeExists(
              `fv.attr_value ~ '^[0-9.]+$' AND CAST(fv.attr_value AS DECIMAL) BETWEEN :${p}Min AND :${p}Max`,
              p,
            ),
            { [`${p}Key`]: key, [`${p}Min`]: value.min, [`${p}Max`]: value.max },
          );
        } else if (value) {
          queryBuilder.andWhere(
            this.variantAttributeExists(`LOWER(fv.attr_value) = :${p}Value`, p),
            { [`${p}Key`]: key, [`${p}Value`]: String(value).toLowerCase() },
          );
        }
      });
    }

    const results = await queryBuilder.getMany();
    return results.map((product) => this.attachDerivedAttributes(product));
  }

  /**
   * `EXISTS` over the product's variant attributes, matching the attribute
   * name case-insensitively.
   *
   * Attribute keys are entered by hand in the admin and in the import sheet,
   * so "Colour", "colour" and "COLOUR" all occur in real data; a filter whose
   * id is `colour` has to find all three. `jsonb_each_text` flattens each
   * variant's attributes into name/value rows so the comparison can be done
   * in SQL rather than by pulling every product into memory.
   */
  private variantAttributeExists(valueCondition: string, param: string): string {
    return `EXISTS (
      SELECT 1
      FROM product_variants fpv
      CROSS JOIN LATERAL jsonb_each_text(fpv.variant_attributes) AS fv(attr_key, attr_value)
      WHERE fpv.product_id = product.id
        AND fpv.is_active = TRUE
        AND LOWER(fv.attr_key) = LOWER(:${param}Key)
        AND ${valueCondition}
    )`;
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
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('product.variations', 'variations')
      .leftJoinAndSelect('product.parentProduct', 'parentProduct')
      .select([
        'product',
        'category.id',
        'category.name',
        'category.slug',
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
      .getOne();
    
    // Variants are always needed here: they hold the product's attributes, so
    // even a product with nothing for the shopper to choose between has one.
    if (product) {
      (product as any).productVariants = await this.getProductVariants(product.id);
      this.attachDerivedAttributes(product);
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
   * Expose the product-level attributes as a read-only `attributes` field.
   *
   * Nothing stores this — it is recomputed from the variants on every read, as
   * the keys every variant agrees on. The admin product form and the export
   * both want "this product's Fabric" rather than "each variant's Fabric", and
   * this gives them that without the database keeping a second copy that can
   * drift out of step with the variants. Writes go the other way, through
   * `storeAttributesOnVariants`.
   */
  private attachDerivedAttributes<T extends { productVariants?: ProductVariant[] }>(
    product: T,
  ): T {
    const variants = product.productVariants || [];
    const derived: Record<string, string> = {};

    if (variants.length > 0) {
      const [first, ...rest] = variants;
      for (const [key, value] of Object.entries(first.variantAttributes || {})) {
        const asString = String(value);
        if (rest.every((v) => String((v.variantAttributes || {})[key]) === asString)) {
          derived[key] = asString;
        }
      }
    }

    (product as any).attributes = derived;
    return product;
  }

  /**
   * Get all variations for a parent product
   */
  async findVariations(parentProductId: string): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'categories')
      .where('product.parentProductId = :parentProductId', { parentProductId })
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
      .leftJoinAndSelect('product.reviews', 'review')
      .leftJoinAndSelect('product.variations', 'variations')
      .leftJoinAndSelect('product.parentProduct', 'parentProduct')
      .leftJoinAndSelect('product.productVariants', 'productVariants')
      .select([
        'product',
        'category.id',
        'category.name',
        'category.slug',
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
      .getOne();
    
    if (product) {
      const variants = await this.getProductVariants(product.id);
      (product as any).productVariants = variants;
      this.attachDerivedAttributes(product);

      if (product.hasVariants && variants.length > 0) {
        (product as any).variantOptions = this.buildVariantOptions(variants);
      }
    }

    return product;
  }

  /**
   * The choices to offer on the product page, derived from the variants.
   *
   * Two things here are load-bearing for the variant picker:
   *
   * Keys are grouped case-insensitively and reported under the spelling the
   * data actually uses. A catalogue that has picked up both `Size` (typed in
   * the admin) and `size` (from an older import that lower-cased its keys)
   * used to produce *two* options, both displayed as "Size", each aware of
   * only half the variants — so choosing from one left the other unsatisfiable
   * and the picker refused every further click. The name is also no longer
   * re-capitalised: the browser looks attributes up by this exact key, and
   * turning `size` into `Size` meant every lookup missed.
   *
   * Each option carries a stable `id`. Without one every option rendered under
   * the same undefined React key, and React reused the wrong button state
   * between them.
   */
  private buildVariantOptions(
    variants: ProductVariant[],
  ): Array<{ id: string; name: string; label: string; values: string[] }> {
    // lower-cased key → the spelling to use, and its values in first-seen order
    const groups = new Map<string, { name: string; values: string[] }>();

    for (const variant of variants) {
      for (const [key, rawValue] of Object.entries(variant.variantAttributes || {})) {
        const value = rawValue == null ? '' : String(rawValue);
        if (!value) continue;

        const groupKey = key.toLowerCase();
        let group = groups.get(groupKey);
        if (!group) {
          group = { name: key, values: [] };
          groups.set(groupKey, group);
        }
        if (!group.values.some((v) => v.toLowerCase() === value.toLowerCase())) {
          group.values.push(value);
        }
      }
    }

    // A key every variant shares one value for is a property of the product,
    // not a choice — offering "Fabric: Chanderi" as the only option asks the
    // shopper to pick from a list of one.
    return Array.from(groups.entries())
      .filter(([, group]) => group.values.length > 1)
      .map(([groupKey, group]) => ({
        id: groupKey,
        name: group.name,
        label: group.name.charAt(0).toUpperCase() + group.name.slice(1),
        values: group.values,
      }));
  }

  async create(productData: any): Promise<Product> {
    const { categoryIds, newFilterOptions, categoryId, variations, variants, variantOptions, attributes, ...data } = productData;

    // Every product is the store's, whatever a client sends.
    data.vendorId = STORE_ID;

    // Ensure GST fields have default values if not provided
    if (!data.priceType) {
      data.priceType = 'mrp_with_gst'; // Default to tax-inclusive pricing
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

    // Derive GST from the category and the item's own price unless the caller
    // states a rate explicitly. Apparel changes band at ₹1,000 per piece, so a
    // rate fixed at creation time goes stale the moment the price is edited —
    // `update` recomputes it for the same reason.
    if (data.gstRate === undefined || data.gstRate === null || data.gstRate === '') {
      data.gstRate = gstRateFor(gstSlugFrom(categories.map((c) => c.slug)), Number(data.price));
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
    
    // Variant SKUs are unique store-wide. Say which are taken before anything is saved,
    // rather than leaving a product behind without its variants.
    if (Array.isArray(variants) && variants.length > 0) {
      const skus: string[] = variants.map((v: any) => v?.sku).filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
      const repeated = [...new Set(skus.filter((s, i) => skus.indexOf(s) !== i))];
      if (repeated.length) {
        throw new BadRequestException(`These variant SKUs appear more than once: ${repeated.join(', ')}`);
      }
      const taken = skus.length
        ? await this.productVariantsRepository.find({ where: { sku: In(skus) }, select: { sku: true } })
        : [];
      if (taken.length) {
        throw new ConflictException(`These SKUs already belong to other products: ${taken.map((t) => t.sku).join(', ')}`);
      }
      for (const variant of variants) {
        if (Array.isArray(variant.images) && variant.images.length > 0) {
          this.validateImageUrls(variant.images);
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
      let totalStock = 0;
      for (const variant of variants) {
        const productVariant = this.productVariantsRepository.create({
          productId: parentProduct.id,
          variantAttributes: variant.attributes,
          sku: variant.sku,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stockQuantity: variant.stock,
          // A colour's own photos, so the product page and the orders show the colour bought.
          images: Array.isArray(variant.images) && variant.images.length > 0 ? variant.images : undefined,
          isActive: true,
        });

        await this.productVariantsRepository.save(productVariant);
        totalStock += Number(variant.stock) || 0;
      }

      // The product's stock is its variants' total, as everywhere else keeps it.
      await this.productsRepository.update(parentProduct.id, { stockQuantity: totalStock });
      parentProduct.stockQuantity = totalStock;
    }

    await this.storeAttributesOnVariants(parentProduct, attributes);

    return parentProduct;
  }

  /**
   * Put a product's filterable attributes where filtering looks for them: on
   * its variants.
   *
   * Callers (the admin form, the import sheet) still describe a product's
   * Fabric or Finish at the product level, which reads naturally — every
   * variant of a chanderi kurti is chanderi. There is no `products.attributes`
   * column to put that in any more, so it is folded into each variant
   * underneath the variant's own keys: a variant that states its own Size
   * keeps it.
   *
   * A product with no variants gets one, mirroring its SKU, price and stock,
   * purely so its attributes have somewhere to live. `hasVariants` is left
   * alone — this is not an option to offer the shopper, and flipping it would
   * make the product page demand a selection before allowing a purchase.
   */
  private async storeAttributesOnVariants(
    product: Product,
    attributes: Record<string, any> | null | undefined,
  ): Promise<void> {
    if (!attributes || typeof attributes !== 'object') return;

    // `booking` and `tour` are nested metadata, not filter values.
    const filterable = Object.fromEntries(
      Object.entries(attributes).filter(
        ([key, value]) =>
          key !== 'booking' &&
          key !== 'tour' &&
          value !== null &&
          value !== undefined &&
          value !== '' &&
          typeof value !== 'object',
      ),
    );

    const metadata = Object.fromEntries(
      Object.entries(attributes).filter(([key]) => key === 'booking' || key === 'tour'),
    );
    if (Object.keys(metadata).length > 0) {
      await this.productsRepository.update(product.id, {
        metadata: { ...(product.metadata || {}), ...metadata },
      });
    }

    if (Object.keys(filterable).length === 0) return;

    const existing = await this.productVariantsRepository.find({
      where: { productId: product.id },
    });

    if (existing.length > 0) {
      // Keys the shopper picks between belong to the variant and are never
      // overwritten from the product. Everything else on the variant was put
      // there by the product last time round, so it is replaced rather than
      // merged — otherwise an attribute the admin deletes lives on forever.
      const variantOwned = this.variantOwnedKeys(product, existing);

      for (const variant of existing) {
        const own = Object.fromEntries(
          Object.entries(variant.variantAttributes || {}).filter(([key]) =>
            variantOwned.has(key.toLowerCase()),
          ),
        );
        variant.variantAttributes = { ...filterable, ...own };
      }
      await this.productVariantsRepository.save(existing);
      return;
    }

    await this.productVariantsRepository.save(
      this.productVariantsRepository.create({
        productId: product.id,
        sku: await this.availableVariantSku(product),
        variantAttributes: filterable,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        stockQuantity: product.stockQuantity ?? 0,
        images: product.images,
        isActive: true,
      }),
    );
  }

  /**
   * The attribute keys that belong to the variants rather than to the product,
   * lowercased. These survive a product-level attribute write untouched.
   *
   * Two sources, unioned, because neither alone is safe:
   *
   * `variantOptions` records what the admin form declared the shopper picks
   * between — but it is only written by that form. Products loaded from the
   * import sheet have variants and no `variantOptions` at all, so trusting it
   * alone would treat their Sizes as product-level and flatten every variant
   * to the same value on the next edit.
   *
   * So any key whose value actually differs between variants counts too. A key
   * that differs is by definition not a property of the product.
   */
  private variantOwnedKeys(product: Product, variants: ProductVariant[]): Set<string> {
    const keys = new Set<string>();

    const options = product.variantOptions as unknown;
    if (Array.isArray(options)) {
      for (const option of options as any[]) {
        if (typeof option?.name === 'string') keys.add(option.name.toLowerCase());
      }
    } else if (options && typeof options === 'object') {
      for (const key of Object.keys(options)) keys.add(key.toLowerCase());
    }

    // lower(key) → the first value seen for it, to spot a disagreement.
    const firstSeen = new Map<string, string>();
    for (const variant of variants) {
      for (const [key, value] of Object.entries(variant.variantAttributes || {})) {
        const lower = key.toLowerCase();
        const asString = String(value);
        const previous = firstSeen.get(lower);
        if (previous === undefined) {
          firstSeen.set(lower, asString);
        } else if (previous.toLowerCase() !== asString.toLowerCase()) {
          keys.add(lower);
        }
      }
    }

    return keys;
  }

  /** Variant SKUs are unique, so fall back if the product's is already taken. */
  private async availableVariantSku(product: Product): Promise<string> {
    const taken = await this.productVariantsRepository.findOne({
      where: { sku: product.sku },
    });
    if (!taken) return product.sku;
    return `${product.sku}-D${product.id.replace(/-/g, '').slice(0, 6)}`;
  }

  async update(id: string, productData: any): Promise<Product | null> {
    const { 
      categoryIds, 
      newFilterOptions,
      categoryId: filterCategoryId,
      variations, 
      vendor,
      vendorId,
      reviews, 
      parentProduct,
      productVariants,
      variantOptions,
      attributes,
      ...data
    } = productData;
    
    // Ensure GST fields have default values if explicitly set to null/undefined
    // Don't override existing values if fields are not in the update payload
    if (data.hasOwnProperty('priceType') && !data.priceType) {
      data.priceType = 'mrp_with_gst';
    }

    // Recompute the GST rate whenever the price or the category moves, because
    // apparel crosses a rate band at ₹1,000 per piece — editing a kurti from
    // ₹950 to ₹1,200 changes its rate from 5% to 12%. An explicit gstRate in
    // the payload still wins.
    const gstRateGiven =
      data.hasOwnProperty('gstRate') && data.gstRate !== null && data.gstRate !== '';
    const priceChanged = data.hasOwnProperty('price');
    const categoryChanged = Array.isArray(categoryIds) && categoryIds.length > 0;

    if (!gstRateGiven && (priceChanged || categoryChanged)) {
      const existing = await this.productsRepository.findOne({
        where: { id },
        relations: ['categories'],
      });

      const slug = gstSlugFrom(
        categoryChanged
          ? (await this.categoriesRepository.find({ where: { id: In(categoryIds) } })).map((c) => c.slug)
          : (existing?.categories ?? []).map((c) => c.slug),
      );

      const unitPrice = priceChanged ? Number(data.price) : Number(existing?.price);
      data.gstRate = gstRateFor(slug, unitPrice);
    } else if (data.hasOwnProperty('gstRate') && !gstRateGiven) {
      // Explicitly blanked — fall back to the derived rate rather than 18%.
      const existing = await this.productsRepository.findOne({
        where: { id },
        relations: ['categories'],
      });
      data.gstRate = gstRateFor(gstSlugFrom((existing?.categories ?? []).map((c) => c.slug)), Number(existing?.price));
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
          // Update existing variant. `images` is the colour's own photo set
          // (the storefront gallery and the order snapshot both prefer it),
          // written only when the admin sent it so older clients leave it be.
          const patch: Partial<ProductVariant> = {
            price: variantData.price,
            compareAtPrice: variantData.compareAtPrice,
            stockQuantity: variantData.stockQuantity,
          };
          if (Array.isArray(variantData.images)) {
            this.validateImageUrls(variantData.images);
            patch.images = variantData.images;
          }
          if (typeof variantData.isActive === 'boolean') patch.isActive = variantData.isActive;
          await this.productVariantsRepository.update(variantData.id, patch);
        }
      }

      // The product's own stock is the sum of its variants', the figure the
      // catalogue list, the low/out-of-stock counts and the storefront read.
      // Orders keep it in step when they move stock; an edit here must too.
      const variants = await this.productVariantsRepository.find({ where: { productId: id } });
      if (variants.length > 0) {
        const total = variants.reduce((s, v) => s + (v.stockQuantity || 0), 0);
        await this.productsRepository.update(id, { stockQuantity: total });
      }
    }

    if (attributes !== undefined) {
      const product = await this.productsRepository.findOne({ where: { id } });
      if (product) await this.storeAttributesOnVariants(product, attributes);
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
    
    // If new filter options are provided, add them to the category
    if (newFilterOptions && filterCategoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: filterCategoryId },
      });
      
      if (category && category.filterConfig?.filters) {
        let updated = false;
        
        category.filterConfig.filters = category.filterConfig.filters.map((filter: any) => {
          if (newFilterOptions[filter.id]) {
            const newOption = newFilterOptions[filter.id];
            const optionExists = filter.options?.some((opt: any) => opt.value === newOption.value);
            
            if (!optionExists) {
              filter.options = [...(filter.options || []), newOption];
              updated = true;
              console.log(`Added new ${filter.label} option: ${newOption.label}`);
            }
          }
          return filter;
        });
        
        if (updated) {
          await this.categoriesRepository.save(category);
        }
      }
    }
    
    return this.findOne(id);
  }

  /**
   * A product with order or booking history is never hard-deleted — that
   * would leave historical orders pointing at nothing. It is archived
   * instead, and the caller must be told which one happened: a client that
   * unconditionally reports "deleted" looks broken when a repeat click on an
   * already-archived product with history does nothing and correctly so.
   */
  async remove(id: string): Promise<{ outcome: 'deleted' | 'archived' | 'already_archived' }> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['productVariants'],
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }

    // Check if product has associated orders
    const orderItemsCount = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('order_items', 'orderItem', 'orderItem.product_id = product.id')
      .where('product.id = :id', { id })
      .select('COUNT(orderItem.id)', 'count')
      .getRawOne();

    // Check if product has associated bookings
    const bookingsCount = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoin('bookings', 'booking', 'booking.product_id = product.id')
      .where('product.id = :id', { id })
      .select('COUNT(booking.id)', 'count')
      .getRawOne();

    const hasHistory =
      (orderItemsCount && parseInt(orderItemsCount.count) > 0) ||
      (bookingsCount && parseInt(bookingsCount.count) > 0);

    if (hasHistory) {
      if (product.status === ProductStatus.ARCHIVED) {
        // Nothing to change — this is the case that used to report "deleted"
        // while doing nothing.
        return { outcome: 'already_archived' };
      }
      await this.productsRepository.update(id, { status: ProductStatus.ARCHIVED });
      return { outcome: 'archived' };
    }

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

    // Delete product from database (cascades to variants)
    await this.productsRepository.delete(id);
    return { outcome: 'deleted' };
  }

  /**
   * Photos in Cloudinary's `marketplace/products` folder that nothing uses,
   * found and, with `deleteOrphans`, deleted.
   *
   * Every upload lands in that folder: product photos, and also the logo,
   * the hero, category and editor's-pick images, page sections and blog
   * posts. An order keeps its item's photo URL after the product is gone. So
   * "in use" means named anywhere in the database, not only by a product.
   * This used to look at products alone, and the Settings page's delete would
   * have taken the logo, the hero and every past order's pictures with it.
   */
  async cleanupOrphanImages(
    deleteOrphans: boolean = false,
  ): Promise<{
    total: number;
    orphans: string[];
    deleted: number;
    errors: string[];
  }> {
    const referenced = await this.referencedCloudinaryIds();
    console.log(`Found ${referenced.size} Cloudinary photos referenced in the database`);
    return this.cloudinaryService.cleanupOrphanImages('marketplace/products', referenced, deleteOrphans);
  }

  /**
   * The public id of every Cloudinary image any text, JSON or array column
   * in the database mentions, read from the URLs themselves, so a URL with
   * a transformation (`/upload/c_fill,w_600/v12/marketplace/...`) counts as
   * the photo it shows.
   */
  private async referencedCloudinaryIds(): Promise<Set<string>> {
    const manager = this.productsRepository.manager;
    const columns: Array<{ table_name: string; column_name: string }> = await manager.query(
      `SELECT c.table_name, c.column_name
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema = current_schema()
          AND t.table_type = 'BASE TABLE'
          AND c.data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')`,
    );

    const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
    const ids = new Set<string>();
    for (const { table_name, column_name } of columns) {
      const column = quote(column_name);
      const rows: Array<{ v: string | null }> = await manager.query(
        `SELECT ${column}::text AS v FROM ${quote(table_name)} WHERE ${column}::text LIKE '%res.cloudinary.com%'`,
      );
      for (const { v } of rows) {
        if (!v) continue;
        for (const match of v.matchAll(/\/upload\/(?:[^\s"'<>]*?\/)?(marketplace\/[^\s"'<>?#,\\{}()]+)/g)) {
          ids.add(match[1].replace(/\.[a-z0-9]{2,5}$/i, ''));
        }
      }
    }
    return ids;
  }
}
