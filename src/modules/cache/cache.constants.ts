// Cache keys constants for consistent cache management
export const CACHE_KEYS = {
  // Products
  PRODUCT_BY_ID: (id: string) => `product:${id}`,
  PRODUCT_BY_SLUG: (slug: string) => `product:slug:${slug}`,
  PRODUCTS_LIST: (page: number, limit: number, filters?: string) => 
    `products:list:${page}:${limit}:${filters || 'all'}`,
  PRODUCT_REVIEWS: (productId: string, page: number) => 
    `product:${productId}:reviews:${page}`,
  
  // Categories
  CATEGORY_BY_ID: (id: string) => `category:${id}`,
  CATEGORY_BY_SLUG: (slug: string) => `category:slug:${slug}`,
  CATEGORIES_LIST: () => 'categories:list',
  CATEGORIES_TREE: () => 'categories:tree',
  
  // Search
  SEARCH_SUGGESTIONS: (query: string) => `search:suggestions:${query.toLowerCase()}`,
  SEARCH_RESULTS: (query: string, type: string, page: number) => 
    `search:${type}:${query}:${page}`,
  
  // Settings
  SETTINGS: () => 'settings',
  
  // Locations
  CITIES_LIST: () => 'locations:cities',
  SUB_LOCATIONS: (cityId: string) => `locations:city:${cityId}:sublocations`,
  
  // Homepage
  HOMEPAGE_DATA: () => 'homepage:data',
  HERO_BANNERS: () => 'homepage:banners',
  FEATURED_PRODUCTS: () => 'homepage:featured',
};

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - default
  LONG: 900, // 15 minutes - for relatively static data
  VERY_LONG: 3600, // 1 hour - for very static data
  DAY: 86400, // 24 hours - for rarely changing data
};
