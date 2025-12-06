import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from './category.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({
      where: { isActive: true, vendorId: IsNull() }, // Only global categories
      order: { sortOrder: 'ASC' },
    });
  }

  async findRootCategories(vendorId?: string, withProductCounts = false): Promise<Category[]> {
    const manager = this.categoriesRepository.manager;
    
    let trees: Category[];
    
    if (vendorId) {
      // Get vendor-specific categories only
      trees = await manager.getTreeRepository(Category).findTrees({
        where: { vendorId },
      } as any);
    } else {
      // Get global categories only
      trees = await manager.getTreeRepository(Category).findTrees({
        where: { vendorId: IsNull() },
      } as any);
    }
    
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
    const manager = this.categoriesRepository.manager;
    
    if (vendorId) {
      // Return both global and vendor categories merged
      const globalTrees = await manager.getTreeRepository(Category).findTrees({
        where: { vendorId: IsNull() },
      } as any);
      
      const vendorTrees = await manager.getTreeRepository(Category).findTrees({
        where: { vendorId },
      } as any);
      
      return [...globalTrees, ...vendorTrees];
    }
    
    const trees = await manager.getTreeRepository(Category).findTrees({
      where: { vendorId: IsNull() },
    } as any);
    return trees;
  }

  async findVendorCategories(vendorId: string, withProductCounts = false): Promise<Category[]> {
    const manager = this.categoriesRepository.manager;
    
    // Get both global categories and vendor-specific categories
    const globalTrees = await manager.getTreeRepository(Category).findTrees({
      where: { vendorId: IsNull() },
    } as any);
    
    const vendorTrees = await manager.getTreeRepository(Category).findTrees({
      where: { vendorId },
    } as any);
    
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