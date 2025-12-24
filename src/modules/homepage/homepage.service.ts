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

  async getHomepageData(cityId?: string, subLocationId?: string) {
    try {
      console.log('[HomepageService] Fetching homepage data...');
      
      // Fetch all data in parallel
      const [
        locationFilterEnabled,
        currency,
        categoryDisplayMode,
        marketplaceLogo,
        marketplaceName,
        categories,
        uncategorizedProducts,
      ] = await Promise.all([
        this.settingsService.getSetting('location_filter_enabled'),
        this.settingsService.getSetting('currency'),
        this.settingsService.getSetting('category_display_mode'),
        this.settingsService.getSetting('marketplace_logo'),
        this.settingsService.getSetting('marketplace_name'),
        this.categoriesService.findAllRootCategories(),
        this.getUncategorizedProducts(cityId, subLocationId),
      ]);

      console.log('[HomepageService] Categories fetched:', categories.length);
      console.log('[HomepageService] Uncategorized products:', uncategorizedProducts.length);

      // Fetch products for each category in parallel
      const productsByCategory = await this.getProductsByCategories(
        categories,
        cityId,
        subLocationId,
      );

      console.log('[HomepageService] Products by category fetched:', Object.keys(productsByCategory).length);

      return {
        settings: {
          locationFilterEnabled: locationFilterEnabled === true || locationFilterEnabled === 'true',
          currency: currency || 'INR',
          categoryDisplayMode: categoryDisplayMode === 'top' ? 'top' : 'sidebar',
          marketplaceLogo: marketplaceLogo || '',
          marketplaceName: marketplaceName || 'GaliCart',
        },
        categories,
        productsByCategory,
        uncategorizedProducts,
      };
    } catch (error) {
      console.error('[HomepageService] Error fetching homepage data:', error);
      throw error;
    }
  }

  private async getProductsByCategories(
    categories: any[],
    cityId?: string,
    subLocationId?: string,
  ) {
    const productPromises = categories.map(async (category) => {
      try {
        const filters: any = { productType: 'physical' };
        if (cityId) filters.cityId = cityId;
        if (subLocationId) filters.subLocationId = subLocationId;

        // Use findByCategory which properly filters by category and location
        const products = await this.productsService.findByCategory(category.id, filters);

        return {
          categorySlug: category.slug,
          products: products || [],
        };
      } catch (error) {
        console.error(`[HomepageService] Error fetching products for category ${category.slug}:`, error);
        return {
          categorySlug: category.slug,
          products: [],
        };
      }
    });

    const results = await Promise.all(productPromises);

    // Convert to object keyed by category slug
    const productsByCategory: Record<string, any[]> = {};
    results.forEach((result) => {
      productsByCategory[result.categorySlug] = result.products;
    });

    return productsByCategory;
  }

  private async getUncategorizedProducts(cityId?: string, subLocationId?: string) {
    try {
      // Call findAll with correct parameters for uncategorized products
      const result = await this.productsService.findAll(
        1,              // page
        100,            // limit
        'active',       // status
        undefined,      // search
        undefined,      // vendorId
        true,           // uncategorized
        cityId,         // cityId
        subLocationId,  // subLocationId
        'physical',     // productType
      );
      
      return result.products || [];
    } catch (error) {
      console.error('[HomepageService] Error fetching uncategorized products:', error);
      return [];
    }
  }
}
