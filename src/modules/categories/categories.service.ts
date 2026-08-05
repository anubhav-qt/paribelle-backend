import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Category } from './category.entity';
import { Product } from '../products/product.entity';
import { FileCleanupService } from '../../common/services/file-cleanup.service';
import { CACHE_TTL } from '../cache/cache.constants';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private fileCleanupService: FileCleanupService,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: { isActive: true, vendorId: IsNull() }, // Only global categories
      order: { sortOrder: 'ASC' },
    });
  }

  /**
   * Loads root categories for a given owner, with their descendants attached.
   *
   * TypeORM's `findTrees({ where })` silently ignores the `where` clause, so
   * every caller that relied on it was getting the whole category table back —
   * which is why vendor stores and the root site both showed each other's
   * categories. Scoping the roots by hand and hydrating each subtree separately
   * is the only way to filter a closure-table tree reliably.
   */
  private async loadScopedTrees(vendorId?: string): Promise<Category[]> {
    const treeRepository = this.categoriesRepository.manager.getTreeRepository(Category);

    const roots = await this.categoriesRepository.find({
      where: { parent: IsNull(), vendorId: vendorId ?? IsNull() },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return Promise.all(roots.map((root) => treeRepository.findDescendantsTree(root)));
  }

  async findRootCategories(vendorId?: string, withProductCounts = false): Promise<Category[]> {
    const trees = await this.loadScopedTrees(vendorId);

    // Filter to only include active categories and their active children
    const activeCategories = this.filterActiveCategories(trees);
    
    // If product counts requested, enrich categories
    if (withProductCounts) {
      return await this.enrichWithProductCounts(activeCategories, vendorId);
    }
    
    return activeCategories;
  }

  private async enrichWithProductCounts(categories: Category[], vendorId?: string): Promise<Category[]> {
    const enrichCategory = async (category: Category): Promise<Category> => {
      // Count products in this category
      const queryBuilder = this.productsRepository
        .createQueryBuilder('product')
        .innerJoin('product.categories', 'category')
        .where('category.id = :categoryId', { categoryId: category.id })
        .andWhere('product.status = :status', { status: 'active' });
      
      if (vendorId) {
        queryBuilder.andWhere('product.vendorId = :vendorId', { vendorId });
      }
      
      const productCount = await queryBuilder.getCount();
      
      console.log(`Category "${category.name}" (${category.id}): ${productCount} products${vendorId ? ` for vendor ${vendorId}` : ''}`);
      
      // Recursively enrich children
      let enrichedChildren: Category[] = [];
      if (category.children && category.children.length > 0) {
        enrichedChildren = await Promise.all(
          category.children.map(child => enrichCategory(child))
        );
      }
      
      return {
        ...category,
        productCount,
        children: enrichedChildren,
      } as Category;
    };
    
    const enrichedCategories = await Promise.all(categories.map(cat => enrichCategory(cat)));
    console.log('Enriched categories:', enrichedCategories.map(c => ({ name: c.name, count: c.productCount })));
    return enrichedCategories;
  }

  async findAllRootCategories(vendorId?: string): Promise<Category[]> {
    const globalTrees = await this.loadScopedTrees();

    if (vendorId) {
      // A vendor store sees the platform's global categories plus its own.
      const vendorTrees = await this.loadScopedTrees(vendorId);
      return [...globalTrees, ...vendorTrees];
    }

    return globalTrees;
  }

  async findVendorCategories(vendorId: string, withProductCounts = false): Promise<Category[]> {
    // Get both global categories and vendor-specific categories
    const globalTrees = await this.loadScopedTrees();
    const vendorTrees = await this.loadScopedTrees(vendorId);

    // Deduplicate categories by ID while preserving tree structure
    const seenIds = new Set<string>();
    
    const deduplicateTree = (categories: Category[]): Category[] => {
      const result: Category[] = [];
      
      for (const cat of categories) {
        if (!seenIds.has(cat.id)) {
          seenIds.add(cat.id);
          
          // Recursively deduplicate children
          if (cat.children && cat.children.length > 0) {
            cat.children = deduplicateTree(cat.children);
          }
          
          result.push(cat);
        }
      }
      
      return result;
    };
    
    // Combine trees: global first, then vendor-specific
    const allTrees = [...globalTrees, ...vendorTrees];
    const deduplicated = deduplicateTree(allTrees);
    
    // Filter active categories
    const activeCategories = this.filterActiveCategories(deduplicated);
    
    // If product counts requested, enrich categories with vendor filter
    if (withProductCounts) {
      return await this.enrichWithProductCounts(activeCategories, vendorId);
    }
    
    return activeCategories;
  }

  private filterActiveCategories(categories: Category[]): Category[] {
    return categories
      .filter(cat => cat.isActive)
      .map(cat => ({
        ...cat,
        children: cat.children ? this.filterActiveCategories(cat.children) : [],
      }));
  }

  async findOne(id: string): Promise<Category | null> {
    return this.categoriesRepository.findOne({
      where: { id },
      relations: ['products', 'children', 'parent'],
    });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.categoriesRepository.findOne({
      where: { slug },
      relations: ['products', 'children', 'parent'],
    });
  }

  async findCategoryWithChildren(slug: string): Promise<Category | null> {
    const manager = this.categoriesRepository.manager;
    const category = await this.categoriesRepository.findOne({
      where: { slug },
      relations: ['parent'],
    });
    
    if (!category) return null;
    
    const tree = await manager.getTreeRepository(Category).findDescendantsTree(category);
    
    // Preserve the parent relationship in the tree
    if (category.parent) {
      tree.parent = category.parent;
    }
    
    return tree;
  }

  async create(categoryData: Partial<Category>): Promise<Category> {
    const { parentId, ...data } = categoryData as any;
    
    const category = this.categoriesRepository.create(data as Partial<Category>);
    
    if (parentId) {
      const parent = await this.categoriesRepository.findOne({
        where: { id: parentId },
      });
      if (parent) {
        category.parent = parent;
      }
    }
    
    return this.categoriesRepository.save(category);
  }

  async update(id: string, categoryData: Partial<Category>): Promise<Category | null> {
    const { parentId, ...data } = categoryData as any;
    
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    
    if (!category) {
      return null;
    }
    
    Object.assign(category, data);
    
    if (parentId !== undefined) {
      if (parentId) {
        const parent = await this.categoriesRepository.findOne({
          where: { id: parentId },
        });
        if (parent) {
          category.parent = parent;
        }
      } else {
        (category as any).parent = null;
      }
    }
    
    await this.categoriesRepository.save(category);
    
    // If deactivating a category, deactivate all descendants
    if (data.isActive === false) {
      await this.deactivateDescendants(id);
    }
    // If activating a category, activate all ancestors
    else if (data.isActive === true) {
      await this.activateAncestors(category);
    }
    
    return this.findOne(id);
  }

  private async deactivateDescendants(categoryId: string): Promise<void> {
    const manager = this.categoriesRepository.manager;
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    
    if (!category) return;
    
    const descendants = await manager.getTreeRepository(Category).findDescendants(category);
    
    // Update all descendants to inactive
    for (const descendant of descendants) {
      if (descendant.id !== categoryId) {
        await this.categoriesRepository.update(descendant.id, { isActive: false });
      }
    }
  }

  private async activateAncestors(category: Category): Promise<void> {
    const manager = this.categoriesRepository.manager;
    const ancestors = await manager.getTreeRepository(Category).findAncestors(category);
    
    // Activate all ancestors
    for (const ancestor of ancestors) {
      if (ancestor.id !== category.id && !ancestor.isActive) {
        await this.categoriesRepository.update(ancestor.id, { isActive: true });
      }
    }
  }

  async remove(id: string): Promise<void> {
    const manager = this.categoriesRepository.manager;
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    
    if (!category) return;
    
    // Get all descendants
    const descendants = await manager.getTreeRepository(Category).findDescendants(category);
    
    // Delete images from all categories (parent + descendants)
    for (const cat of descendants) {
      await this.fileCleanupService.deleteEntityImages(cat, ['image']);
    }
    
    // Delete all descendants first (in reverse order to avoid FK issues)
    const descendantIds = descendants.map(d => d.id).filter(dId => dId !== id);
    if (descendantIds.length > 0) {
      await this.categoriesRepository.delete(descendantIds);
    }
    
    // Delete the category itself
    await this.categoriesRepository.delete(id);
  }

  async updateFilters(id: string, filtersDto: any): Promise<Category | null> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });
    
    if (!category) {
      return null;
    }

    category.filterConfig = { filters: filtersDto.filters };
    await this.categoriesRepository.save(category);
    await this.invalidateEffectiveFiltersCache(id);
    return category;
  }

  async getFilters(categoryId: string): Promise<any> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    
    if (!category) {
      return null;
    }

    // If no filters defined, try to inherit from parent
    if (!category.filterConfig?.filters && category.parent) {
      const manager = this.categoriesRepository.manager;
      const parentCategory = await manager.getTreeRepository(Category).findAncestors(category);
      
      for (const ancestor of parentCategory) {
        if (ancestor.filterConfig?.filters) {
          return ancestor.filterConfig;
        }
      }
    }

    return category.filterConfig || { filters: [] };
  }

  /**
   * The attributes the category's products actually carry, as ready-made
   * filter definitions.
   *
   * Filter options used to be typed in by hand against a template, so they
   * drifted from the catalogue: an option for a value no products had returned
   * nothing, and a value no option covered was unreachable. Reading them back
   * out of `product_variants.variant_attributes` — the one place attributes
   * live — means the offered filters are exactly what is on the shelves.
   *
   * Values are grouped case-insensitively and reported under the spelling used
   * most often, since the same attribute is typed differently by different
   * people over time.
   */
  async suggestFiltersFromCatalogue(categoryId: string): Promise<{
    filters: Array<{
      id: string;
      label: string;
      type: 'checkbox';
      options: Array<{ value: string; label: string; productCount: number }>;
    }>;
  }> {
    const categoryIds = await this.getDescendantCategoryIds(categoryId);

    const rows: Array<{ attr_key: string; attr_value: string; product_count: string }> =
      await this.categoriesRepository.manager.query(
        `
        SELECT a.attr_key, a.attr_value, COUNT(DISTINCT p.id) AS product_count
        FROM products p
        JOIN product_categories pc ON pc.product_id = p.id
        JOIN product_variants v ON v.product_id = p.id
        CROSS JOIN LATERAL jsonb_each_text(v.variant_attributes) AS a(attr_key, attr_value)
        WHERE pc.category_id = ANY($1)
          AND p.status = 'active'
          AND v.is_active = TRUE
          AND a.attr_value <> ''
        GROUP BY a.attr_key, a.attr_value
        ORDER BY a.attr_key, product_count DESC, a.attr_value
        `,
        [categoryIds],
      );

    // lower(key) → { label, options keyed by lower(value) }
    const byKey = new Map<
      string,
      { label: string; options: Map<string, { value: string; label: string; productCount: number }> }
    >();

    for (const row of rows) {
      const keyId = row.attr_key.toLowerCase();
      let group = byKey.get(keyId);
      if (!group) {
        group = { label: row.attr_key, options: new Map() };
        byKey.set(keyId, group);
      }

      const valueId = row.attr_value.toLowerCase();
      const count = Number(row.product_count);
      const existing = group.options.get(valueId);
      if (existing) {
        existing.productCount += count;
      } else {
        group.options.set(valueId, {
          value: row.attr_value,
          label: row.attr_value,
          productCount: count,
        });
      }
    }

    return {
      filters: Array.from(byKey.entries()).map(([id, group]) => ({
        id,
        label: group.label.charAt(0).toUpperCase() + group.label.slice(1),
        type: 'checkbox' as const,
        options: Array.from(group.options.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        ),
      })),
    };
  }

  private effectiveFiltersCacheKey(categoryId: string): string {
    return `category:${categoryId}:filters:effective`;
  }

  /**
   * The filters a shopper actually sees for a category: every attribute the
   * catalogue currently carries (from `suggestFiltersFromCatalogue`), with
   * `filterConfig` demoted from a copy of the data to a thin layer of
   * overrides on top of it — rename a filter's label, pin its display order,
   * or hide it, but never hand-type an option. A filter snapshotted at import
   * time goes stale the moment a product changes; a category derived on read
   * cannot.
   *
   * Cached for `CACHE_TTL.MEDIUM` — the underlying query is a
   * `CROSS JOIN LATERAL` over every variant in the category's subtree, too
   * expensive to run on every storefront page view. Invalidated explicitly
   * wherever a write can change the answer: `updateFilters`, product/variant
   * writes, and the Excel importer — see `invalidateEffectiveFiltersCache`.
   */
  async getEffectiveFilters(categoryId: string): Promise<{
    filters: Array<{
      id: string;
      label: string;
      type: 'checkbox';
      sortOrder: number;
      options: Array<{ value: string; label: string; productCount: number }>;
    }>;
  }> {
    const cacheKey = this.effectiveFiltersCacheKey(categoryId);
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const [derived, category] = await Promise.all([
      this.suggestFiltersFromCatalogue(categoryId),
      this.categoriesRepository.findOne({ where: { id: categoryId } }),
    ]);

    const overrides = new Map<string, { label?: string; sortOrder?: number; hidden?: boolean }>();
    for (const f of category?.filterConfig?.filters || []) {
      overrides.set(f.id, {
        label: (f as any).label,
        sortOrder: (f as any).sortOrder,
        hidden: (f as any).hidden,
      });
    }

    const filters = derived.filters
      .map((f, index) => {
        const override = overrides.get(f.id);
        return {
          id: f.id,
          label: override?.label || f.label,
          type: f.type,
          sortOrder: override?.sortOrder ?? index,
          hidden: override?.hidden ?? false,
          // Highest-demand options first, so the list a shopper scans leads
          // with the values most likely to narrow their search usefully.
          options: [...f.options].sort((a, b) =>
            b.productCount !== a.productCount
              ? b.productCount - a.productCount
              : a.label.localeCompare(b.label),
          ),
        };
      })
      .filter((f) => !f.hidden)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ hidden, ...f }) => f);

    const result = { filters };
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);
    return result;
  }

  /**
   * Call after any write that can change what `getEffectiveFilters` returns
   * for this category: a product gaining/losing a category, a variant's
   * attributes changing, or an admin editing `filterConfig` overrides.
   *
   * Ancestors are included because `suggestFiltersFromCatalogue` reads every
   * descendant's products — a change three levels down is visible at the
   * root category too, and its cached answer would otherwise go stale
   * silently until the TTL expired.
   */
  async invalidateEffectiveFiltersCache(categoryId: string): Promise<void> {
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) return;

    const ancestors = await this.categoriesRepository.manager
      .getTreeRepository(Category)
      .findAncestors(category);

    await Promise.all(
      ancestors.map((c) => this.cacheManager.del(this.effectiveFiltersCacheKey(c.id))),
    );
  }

  /** A category and everything beneath it, so a parent sees its children's products. */
  private async getDescendantCategoryIds(categoryId: string): Promise<string[]> {
    const ids: string[] = [categoryId];

    const walk = async (parentId: string) => {
      const children = await this.categoriesRepository.find({
        where: { parent: { id: parentId } },
      });
      for (const child of children) {
        ids.push(child.id);
        await walk(child.id);
      }
    };

    await walk(categoryId);
    return ids;
  }

  async autoInitializeFilters(categoryId: string): Promise<void> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    
    if (!category || category.filterConfig?.filters) {
      // Category not found or already has filters
      return;
    }

    // Initialize with default filters
    const defaultFilters = [
      {
        id: 'price',
        label: 'Price Range',
        type: 'range' as const,
        min: 0,
        max: 10000,
        step: 100,
      },
      {
        id: 'brand',
        label: 'Brand',
        type: 'checkbox' as const,
        options: [],
      },
      {
        id: 'rating',
        label: 'Customer Rating',
        type: 'checkbox' as const,
        options: [
          { value: '4', label: '4★ & above' },
          { value: '3', label: '3★ & above' },
          { value: '2', label: '2★ & above' },
        ],
      },
    ];

    category.filterConfig = { filters: defaultFilters };
    await this.categoriesRepository.save(category);
  }
}