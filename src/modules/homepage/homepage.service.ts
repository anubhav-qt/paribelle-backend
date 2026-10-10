import { Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../admin/settings.service';

@Injectable()
export class HomepageService {
  constructor(
    private categoriesService: CategoriesService,
    private productsService: ProductsService,
    private settingsService: SettingsService,
  ) {}

  async getHomepageData() {
    const [currency, categoryDisplayMode, marketplaceLogo, marketplaceName, categories, uncategorizedProducts] =
      await Promise.all([
        this.settingsService.getSetting('currency'),
        this.settingsService.getSetting('category_display_mode'),
        this.settingsService.getSetting('marketplace_logo'),
        this.settingsService.getSetting('marketplace_name'),
        this.categoriesService.findRootCategories(),
        this.getUncategorizedProducts(),
      ]);

    return {
      settings: {
        currency: currency || 'INR',
        categoryDisplayMode: categoryDisplayMode === 'top' ? 'top' : 'sidebar',
        marketplaceLogo: marketplaceLogo || '',
        marketplaceName: marketplaceName || 'PariBelle',
      },
      categories,
      productsByCategory: await this.getProductsByCategories(categories),
      uncategorizedProducts,
    };
  }

  /** Flattens a category tree so every level gets its own product bucket. */
  private flattenCategories(categories: any[]): any[] {
    return categories.flatMap((category) => [category, ...this.flattenCategories(category.children || [])]);
  }

  private async getProductsByCategories(categories: any[]) {
    // Storefronts browse by subcategory (Kurtis, Jewellery), not just by the
    // top-level parent, so each descendant needs its own bucket.
    const results = await Promise.all(
      this.flattenCategories(categories).map(async (category) => {
        try {
          const products = await this.productsService.findByCategory(category.id, { productType: 'physical' });
          return { categorySlug: category.slug, products: products || [] };
        } catch (error) {
          console.error(`[HomepageService] Error fetching products for category ${category.slug}:`, error);
          return { categorySlug: category.slug, products: [] };
        }
      }),
    );

    const productsByCategory: Record<string, any[]> = {};
    for (const result of results) {
      productsByCategory[result.categorySlug] = result.products;
    }
    return productsByCategory;
  }

  private async getUncategorizedProducts() {
    try {
      const result = await this.productsService.findAll(1, 100, 'active', undefined, true, 'physical');
      return result.products || [];
    } catch (error) {
      console.error('[HomepageService] Error fetching uncategorized products:', error);
      return [];
    }
  }
}
