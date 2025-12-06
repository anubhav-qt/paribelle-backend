import { FilterType } from '../modules/categories/dto/category-filter.dto';

export const COMMON_FILTERS = {
  // Price filter - can be customized per category
  price: (min = 0, max = 100000, step = 100) => ({
    id: 'price',
    label: 'Price Range',
    type: FilterType.RANGE,
    min,
    max,
    step,
  }),

  // Brand filter - options can be added per category
  brand: (brands: string[]) => ({
    id: 'brand',
    label: 'Brand',
    type: FilterType.CHECKBOX,
    options: brands.map((b) => ({
      label: b,
      value: b.toLowerCase().replace(/\s+/g, '-').replace(/'/g, ''),
    })),
  }),

  // Color filter
  color: () => ({
    id: 'color',
    label: 'Color',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Black', value: 'black' },
      { label: 'White', value: 'white' },
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue' },
      { label: 'Green', value: 'green' },
      { label: 'Yellow', value: 'yellow' },
      { label: 'Pink', value: 'pink' },
      { label: 'Gray', value: 'gray' },
      { label: 'Brown', value: 'brown' },
      { label: 'Purple', value: 'purple' },
      { label: 'Orange', value: 'orange' },
    ],
  }),

  // Size filter - for clothing
  clothingSize: () => ({
    id: 'size',
    label: 'Size',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'XS', value: 'xs' },
      { label: 'S', value: 's' },
      { label: 'M', value: 'm' },
      { label: 'L', value: 'l' },
      { label: 'XL', value: 'xl' },
      { label: 'XXL', value: 'xxl' },
      { label: '3XL', value: '3xl' },
    ],
  }),

  // Rating filter
  rating: () => ({
    id: 'rating',
    label: 'Customer Rating',
    type: FilterType.CHECKBOX,
    options: [
      { label: '4★ & Above', value: '4' },
      { label: '3★ & Above', value: '3' },
      { label: '2★ & Above', value: '2' },
      { label: '1★ & Above', value: '1' },
    ],
  }),

  // Discount filter
  discount: () => ({
    id: 'discount',
    label: 'Discount',
    type: FilterType.CHECKBOX,
    options: [
      { label: '50% or more', value: '50' },
      { label: '40% or more', value: '40' },
      { label: '30% or more', value: '30' },
      { label: '20% or more', value: '20' },
      { label: '10% or more', value: '10' },
    ],
  }),

  // Availability filter
  availability: () => ({
    id: 'availability',
    label: 'Availability',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'In Stock', value: 'in-stock' },
      { label: 'Out of Stock', value: 'out-of-stock' },
    ],
  }),

  // Condition filter
  condition: () => ({
    id: 'condition',
    label: 'Condition',
    type: FilterType.SELECT,
    options: [
      { label: 'New', value: 'new' },
      { label: 'Refurbished', value: 'refurbished' },
      { label: 'Used', value: 'used' },
    ],
  }),

  // Warranty filter
  warranty: () => ({
    id: 'warranty',
    label: 'Warranty',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'No Warranty', value: 'none' },
      { label: '6 Months', value: '6m' },
      { label: '1 Year', value: '1y' },
      { label: '2 Years', value: '2y' },
      { label: '3+ Years', value: '3y' },
    ],
  }),

  // Material filter
  material: (materials?: string[]) => ({
    id: 'material',
    label: 'Material',
    type: FilterType.CHECKBOX,
    options: materials
      ? materials.map((m) => ({
          label: m,
          value: m.toLowerCase().replace(/\s+/g, '-'),
        }))
      : [
          { label: 'Wood', value: 'wood' },
          { label: 'Metal', value: 'metal' },
          { label: 'Plastic', value: 'plastic' },
          { label: 'Glass', value: 'glass' },
          { label: 'Fabric', value: 'fabric' },
          { label: 'Leather', value: 'leather' },
          { label: 'Cotton', value: 'cotton' },
        ],
  }),

  // Gender filter
  gender: () => ({
    id: 'gender',
    label: 'Gender',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Men', value: 'men' },
      { label: 'Women', value: 'women' },
      { label: 'Unisex', value: 'unisex' },
      { label: 'Kids', value: 'kids' },
    ],
  }),

  // Age group filter
  ageGroup: () => ({
    id: 'ageGroup',
    label: 'Age Group',
    type: FilterType.CHECKBOX,
    options: [
      { label: '0-2 years', value: '0-2' },
      { label: '3-5 years', value: '3-5' },
      { label: '6-8 years', value: '6-8' },
      { label: '9-12 years', value: '9-12' },
      { label: '13+ years', value: '13+' },
    ],
  }),

  // Skin type filter
  skinType: () => ({
    id: 'skinType',
    label: 'Skin Type',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Oily', value: 'oily' },
      { label: 'Dry', value: 'dry' },
      { label: 'Combination', value: 'combination' },
      { label: 'Sensitive', value: 'sensitive' },
      { label: 'Normal', value: 'normal' },
      { label: 'All Skin Types', value: 'all' },
    ],
  }),

  // Dietary filter
  dietary: () => ({
    id: 'dietary',
    label: 'Dietary',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Organic', value: 'organic' },
      { label: 'Vegan', value: 'vegan' },
      { label: 'Vegetarian', value: 'vegetarian' },
      { label: 'Gluten Free', value: 'glutenfree' },
      { label: 'Sugar Free', value: 'sugarfree' },
      { label: 'Keto', value: 'keto' },
      { label: 'Low Carb', value: 'lowcarb' },
    ],
  }),

  // Pet type filter
  petType: () => ({
    id: 'petType',
    label: 'Pet Type',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Dog', value: 'dog' },
      { label: 'Cat', value: 'cat' },
      { label: 'Bird', value: 'bird' },
      { label: 'Fish', value: 'fish' },
      { label: 'Small Pets', value: 'small-pets' },
    ],
  }),

  // Format filter (for books, media)
  format: () => ({
    id: 'format',
    label: 'Format',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Hardcover', value: 'hardcover' },
      { label: 'Paperback', value: 'paperback' },
      { label: 'eBook', value: 'ebook' },
      { label: 'Audio', value: 'audio' },
    ],
  }),

  // Language filter
  language: () => ({
    id: 'language',
    label: 'Language',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'English', value: 'english' },
      { label: 'Hindi', value: 'hindi' },
      { label: 'Spanish', value: 'spanish' },
      { label: 'French', value: 'french' },
      { label: 'German', value: 'german' },
    ],
  }),
};

// Preset combinations for common categories
export const FILTER_PRESETS = {
  electronics: [
    COMMON_FILTERS.brand(['Samsung', 'Apple', 'Sony', 'LG', 'Dell', 'HP', 'Lenovo', 'JBL', 'Bose']),
    COMMON_FILTERS.warranty(),
    COMMON_FILTERS.condition(),
    COMMON_FILTERS.price(0, 100000, 1000),
    COMMON_FILTERS.rating(),
    COMMON_FILTERS.discount(),
    COMMON_FILTERS.availability(),
  ],

  fashion: [
    COMMON_FILTERS.brand(['Nike', 'Adidas', 'Puma', 'Zara', 'H&M', 'Levis', 'Tommy Hilfiger']),
    COMMON_FILTERS.clothingSize(),
    COMMON_FILTERS.color(),
    COMMON_FILTERS.gender(),
    COMMON_FILTERS.price(0, 10000, 200),
    COMMON_FILTERS.rating(),
    COMMON_FILTERS.discount(),
  ],

  home: [
    COMMON_FILTERS.brand(['IKEA', 'Philips', 'Amazon Basics', 'Urban Ladder']),
    COMMON_FILTERS.material(),
    COMMON_FILTERS.color(),
    COMMON_FILTERS.price(0, 50000, 1000),
    COMMON_FILTERS.rating(),
  ],

  books: [
    COMMON_FILTERS.format(),
    COMMON_FILTERS.language(),
    COMMON_FILTERS.price(0, 5000, 100),
    COMMON_FILTERS.rating(),
  ],

  sports: [
    COMMON_FILTERS.brand(['Nike', 'Adidas', 'Puma', 'Reebok', 'Decathlon']),
    {
      id: 'activity',
      label: 'Activity',
      type: FilterType.CHECKBOX,
      options: [
        { label: 'Running', value: 'running' },
        { label: 'Gym', value: 'gym' },
        { label: 'Yoga', value: 'yoga' },
        { label: 'Cycling', value: 'cycling' },
        { label: 'Swimming', value: 'swimming' },
        { label: 'Camping', value: 'camping' },
      ],
    },
    COMMON_FILTERS.price(0, 20000, 500),
    COMMON_FILTERS.rating(),
  ],

  beauty: [
    COMMON_FILTERS.brand(['Loreal', 'Maybelline', 'Lakme', 'Nivea', 'Dove', 'Garnier']),
    COMMON_FILTERS.skinType(),
    COMMON_FILTERS.price(0, 5000, 100),
    COMMON_FILTERS.rating(),
    COMMON_FILTERS.discount(),
  ],

  toys: [
    COMMON_FILTERS.ageGroup(),
    {
      id: 'type',
      label: 'Type',
      type: FilterType.CHECKBOX,
      options: [
        { label: 'Educational', value: 'educational' },
        { label: 'Board Game', value: 'board-game' },
        { label: 'Puzzle', value: 'puzzle' },
        { label: 'Action Figure', value: 'action-figure' },
        { label: 'Doll', value: 'doll' },
      ],
    },
    COMMON_FILTERS.price(0, 10000, 500),
    COMMON_FILTERS.rating(),
  ],

  food: [
    COMMON_FILTERS.dietary(),
    COMMON_FILTERS.brand(['Organic India', 'Nestle', 'Amul', 'Britannia']),
    COMMON_FILTERS.price(0, 2000, 50),
    COMMON_FILTERS.rating(),
  ],

  pets: [
    COMMON_FILTERS.petType(),
    {
      id: 'category',
      label: 'Product Category',
      type: FilterType.CHECKBOX,
      options: [
        { label: 'Food', value: 'food' },
        { label: 'Toys', value: 'toys' },
        { label: 'Accessories', value: 'accessories' },
        { label: 'Health & Wellness', value: 'health' },
      ],
    },
    COMMON_FILTERS.price(0, 5000, 100),
    COMMON_FILTERS.rating(),
  ],
};
