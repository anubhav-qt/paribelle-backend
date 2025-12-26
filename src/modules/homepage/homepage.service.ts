import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../admin/settings.service';
import { Vendor } from '../vendors/vendor.entity';

@Injectable()
export class HomepageService {
  constructor(
    private categoriesService: CategoriesService,
    private productsService: ProductsService,
    private settingsService: SettingsService,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
  ) {}

  async getHomepageData(cityId?: string, subLocationId?: string, vendorSlug?: string) {
    try {
      console.log('[HomepageService] Fetching homepage data...', { cityId, subLocationId, vendorSlug });
      
      // If vendorSlug is provided, get the vendor ID first
      let vendorId: string | undefined;
      if (vendorSlug) {
        const vendor = await this.getVendorBySlug(vendorSlug);
        vendorId = vendor?.id;
        console.log('[HomepageService] Vendor found:', vendorId);
      }
      
      // Fetch all data in parallel
      const [
        locationFilterEnabled,
        currency,
        categoryDisplayMode,
        marketplaceLogo,
        marketplaceName,
        categories,
        uncategorizedProducts,
        bookingProducts,
      ] = await Promise.all([
        this.settingsService.getSetting('location_filter_enabled'),
        this.settingsService.getSetting('currency'),
        this.settingsService.getSetting('category_display_mode'),
        this.settingsService.getSetting('marketplace_logo'),
        this.settingsService.getSetting('marketplace_name'),
        this.categoriesService.findAllRootCategories(),
        this.getUncategorizedProducts(cityId, subLocationId, vendorId),
        this.getBookingProducts(cityId, subLocationId, vendorId),
      ]);

      console.log('[HomepageService] Categories fetched:', categories.length);
      console.log('[HomepageService] Uncategorized products:', uncategorizedProducts.length);
      console.log('[HomepageService] Booking products:', bookingProducts.length);

      // Fetch products for each category in parallel
      const productsByCategory = await this.getProductsByCategories(
        categories,
        cityId,
        subLocationId,
        vendorId,
      );

      console.log('[HomepageService] Products by category fetched:', Object.keys(productsByCategory).length);

      // Add booking products as a special category if there are any
      if (bookingProducts.length > 0) {
        productsByCategory['bookings-services'] = bookingProducts;
      }

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
    vendorId?: string,
  ) {
    const productPromises = categories.map(async (category) => {
      try {
        const filters: any = { productType: 'physical' };
        if (cityId) filters.cityId = cityId;
        if (subLocationId) filters.subLocationId = subLocationId;
        if (vendorId) filters.vendorId = vendorId;

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

  private async getUncategorizedProducts(cityId?: string, subLocationId?: string, vendorId?: string) {
    try {
      // Call findAll with correct parameters for uncategorized products
      const result = await this.productsService.findAll(
        1,              // page
        100,            // limit
        'active',       // status
        undefined,      // search
        vendorId,       // vendorId
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

  private async getBookingProducts(cityId?: string, subLocationId?: string, vendorId?: string) {
    try {
      const result = await this.productsService.findAll(
        1,              // page
        100,            // limit
        'active',       // status
        undefined,      // search
        vendorId,       // vendorId
        false,          // uncategorized
        cityId,         // cityId
        subLocationId,  // subLocationId
        'booking',      // productType
      );
      
      return result.products || [];
    } catch (error) {
      console.error('[HomepageService] Error fetching booking products:', error);
      return [];
    }
  }

  private async getVendorBySlug(slug: string) {
    try {
      return await this.vendorRepository.findOne({
        where: { slug },
      });
    } catch (error) {
      console.error('[HomepageService] Error fetching vendor by slug:', error);
      return null;
    }
  }
}
