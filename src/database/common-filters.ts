import { FilterType } from '../modules/categories/dto/category-filter.dto';

// Filter builders used by seed-category-filters.ts. Ids here must match the
// keys used in the `Attributes` column of the product import sheet
// (see products-excel.service.ts) — a filter only narrows results if its id
// matches an attribute key products actually carry.
export const COMMON_FILTERS = {
  price: (min = 0, max = 100000, step = 100) => ({
    id: 'price',
    label: 'Price Range',
    type: FilterType.RANGE,
    min,
    max,
    step,
  }),

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

  fabric: () => ({
    id: 'fabric',
    label: 'Fabric',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Cotton', value: 'cotton' },
      { label: 'Chanderi', value: 'chanderi' },
      { label: 'Silk', value: 'silk' },
      { label: 'Rayon', value: 'rayon' },
      { label: 'Georgette', value: 'georgette' },
      { label: 'Muslin', value: 'muslin' },
    ],
  }),

  colour: () => ({
    id: 'colour',
    label: 'Colour',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Rose', value: 'rose' },
      { label: 'Ivory', value: 'ivory' },
      { label: 'Indigo', value: 'indigo' },
      { label: 'Black', value: 'black' },
      { label: 'Mustard', value: 'mustard' },
      { label: 'Green', value: 'green' },
      { label: 'Maroon', value: 'maroon' },
    ],
  }),

  size: () => ({
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

  sleeve: () => ({
    id: 'sleeve',
    label: 'Sleeve',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Sleeveless', value: 'sleeveless' },
      { label: 'Short', value: 'short' },
      { label: 'Three-Quarter', value: 'three-quarter' },
      { label: 'Full', value: 'full' },
    ],
  }),

  occasionKurtis: () => ({
    id: 'occasion',
    label: 'Occasion',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Everyday', value: 'everyday' },
      { label: 'Work', value: 'work' },
      { label: 'Festive', value: 'festive' },
      { label: 'Wedding', value: 'wedding' },
    ],
  }),

  jewelleryType: () => ({
    id: 'type',
    label: 'Type',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Earrings', value: 'earrings' },
      { label: 'Necklace', value: 'necklace' },
      { label: 'Bangles', value: 'bangles' },
      { label: 'Ring', value: 'ring' },
      { label: 'Anklet', value: 'anklet' },
    ],
  }),

  finish: () => ({
    id: 'finish',
    label: 'Finish',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Gold-tone', value: 'gold-tone' },
      { label: 'Silver-tone', value: 'silver-tone' },
      { label: 'Oxidised', value: 'oxidised' },
      { label: 'Rose Gold', value: 'rose-gold' },
    ],
  }),

  stone: () => ({
    id: 'stone',
    label: 'Stone / Work',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Kundan', value: 'kundan' },
      { label: 'Meenakari', value: 'meenakari' },
      { label: 'Pearl', value: 'pearl' },
      { label: 'American Diamond', value: 'american-diamond' },
      { label: 'Beads', value: 'beads' },
    ],
  }),

  occasionJewellery: () => ({
    id: 'occasion',
    label: 'Occasion',
    type: FilterType.CHECKBOX,
    options: [
      { label: 'Everyday', value: 'everyday' },
      { label: 'Festive', value: 'festive' },
      { label: 'Wedding', value: 'wedding' },
    ],
  }),
};

// Preset combinations, one per live category.
export const FILTER_PRESETS = {
  kurtis: [
    COMMON_FILTERS.fabric(),
    COMMON_FILTERS.colour(),
    COMMON_FILTERS.size(),
    COMMON_FILTERS.sleeve(),
    COMMON_FILTERS.occasionKurtis(),
    COMMON_FILTERS.price(0, 10000, 200),
    COMMON_FILTERS.rating(),
    COMMON_FILTERS.discount(),
  ],

  jewellery: [
    COMMON_FILTERS.jewelleryType(),
    COMMON_FILTERS.finish(),
    COMMON_FILTERS.stone(),
    COMMON_FILTERS.occasionJewellery(),
    COMMON_FILTERS.price(0, 20000, 200),
    COMMON_FILTERS.rating(),
    COMMON_FILTERS.discount(),
  ],
};
