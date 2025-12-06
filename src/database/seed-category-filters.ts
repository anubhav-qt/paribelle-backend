import { DataSource } from 'typeorm';
import { Category } from '../modules/categories/category.entity';

export async function seedCategoryFilters(dataSource: DataSource) {
  const categoryRepo = dataSource.getRepository(Category);

  console.log('🔧 Seeding category filters...');

  // Fashion & Clothing filters
  const fashion = await categoryRepo.findOne({ where: { slug: 'fashion-clothing' } });
  if (fashion) {
    fashion.filterConfig = {
      filters: [
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'nike', label: 'Nike' },
            { value: 'adidas', label: 'Adidas' },
            { value: 'puma', label: 'Puma' },
            { value: 'zara', label: 'Zara' },
            { value: 'hm', label: 'H&M' },
            { value: 'levis', label: "Levi's" },
            { value: 'gap', label: 'GAP' },
          ],
        },
        {
          id: 'size',
          label: 'Size',
          type: 'checkbox',
          options: [
            { value: 'xs', label: 'XS' },
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' },
            { value: 'xl', label: 'XL' },
            { value: 'xxl', label: 'XXL' },
          ],
        },
        {
          id: 'color',
          label: 'Color',
          type: 'checkbox',
          options: [
            { value: 'black', label: 'Black' },
            { value: 'white', label: 'White' },
            { value: 'blue', label: 'Blue' },
            { value: 'red', label: 'Red' },
            { value: 'green', label: 'Green' },
            { value: 'yellow', label: 'Yellow' },
            { value: 'navy', label: 'Navy' },
            { value: 'grey', label: 'Grey' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 10000,
          step: 500,
        },
      ],
    };
    await categoryRepo.save(fashion);
    console.log('✅ Fashion filters added');
  }

  // Electronics filters
  const electronics = await categoryRepo.findOne({ where: { slug: 'electronics' } });
  if (electronics) {
    electronics.filterConfig = {
      filters: [
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'samsung', label: 'Samsung' },
            { value: 'apple', label: 'Apple' },
            { value: 'sony', label: 'Sony' },
            { value: 'lg', label: 'LG' },
            { value: 'dell', label: 'Dell' },
            { value: 'hp', label: 'HP' },
            { value: 'lenovo', label: 'Lenovo' },
            { value: 'jbl', label: 'JBL' },
            { value: 'bose', label: 'Bose' },
          ],
        },
        {
          id: 'warranty',
          label: 'Warranty',
          type: 'checkbox',
          options: [
            { value: '6m', label: '6 Months' },
            { value: '1y', label: '1 Year' },
            { value: '2y', label: '2 Years' },
            { value: '3y', label: '3 Years' },
          ],
        },
        {
          id: 'condition',
          label: 'Condition',
          type: 'checkbox',
          options: [
            { value: 'new', label: 'New' },
            { value: 'refurbished', label: 'Refurbished' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 100000,
          step: 1000,
        },
      ],
    };
    await categoryRepo.save(electronics);
    console.log('✅ Electronics filters added');
  }

  // Home & Living filters
  const home = await categoryRepo.findOne({ where: { slug: 'home-living' } });
  if (home) {
    home.filterConfig = {
      filters: [
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'ikea', label: 'IKEA' },
            { value: 'philips', label: 'Philips' },
            { value: 'amazon-basics', label: 'Amazon Basics' },
            { value: 'urban-ladder', label: 'Urban Ladder' },
          ],
        },
        {
          id: 'material',
          label: 'Material',
          type: 'checkbox',
          options: [
            { value: 'wood', label: 'Wood' },
            { value: 'metal', label: 'Metal' },
            { value: 'plastic', label: 'Plastic' },
            { value: 'glass', label: 'Glass' },
            { value: 'fabric', label: 'Fabric' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 50000,
          step: 1000,
        },
      ],
    };
    await categoryRepo.save(home);
    console.log('✅ Home & Living filters added');
  }

  // Books & Media filters
  const books = await categoryRepo.findOne({ where: { slug: 'books-media' } });
  if (books) {
    books.filterConfig = {
      filters: [
        {
          id: 'format',
          label: 'Format',
          type: 'checkbox',
          options: [
            { value: 'paperback', label: 'Paperback' },
            { value: 'hardcover', label: 'Hardcover' },
            { value: 'ebook', label: 'E-Book' },
            { value: 'audiobook', label: 'Audiobook' },
          ],
        },
        {
          id: 'language',
          label: 'Language',
          type: 'checkbox',
          options: [
            { value: 'english', label: 'English' },
            { value: 'hindi', label: 'Hindi' },
            { value: 'spanish', label: 'Spanish' },
            { value: 'french', label: 'French' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 5000,
          step: 100,
        },
      ],
    };
    await categoryRepo.save(books);
    console.log('✅ Books & Media filters added');
  }

  // Sports & Outdoors filters
  const sports = await categoryRepo.findOne({ where: { slug: 'sports-outdoors' } });
  if (sports) {
    sports.filterConfig = {
      filters: [
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'nike', label: 'Nike' },
            { value: 'adidas', label: 'Adidas' },
            { value: 'puma', label: 'Puma' },
            { value: 'reebok', label: 'Reebok' },
            { value: 'decathlon', label: 'Decathlon' },
          ],
        },
        {
          id: 'activity',
          label: 'Activity',
          type: 'checkbox',
          options: [
            { value: 'running', label: 'Running' },
            { value: 'gym', label: 'Gym' },
            { value: 'yoga', label: 'Yoga' },
            { value: 'cycling', label: 'Cycling' },
            { value: 'swimming', label: 'Swimming' },
            { value: 'camping', label: 'Camping' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 20000,
          step: 500,
        },
      ],
    };
    await categoryRepo.save(sports);
    console.log('✅ Sports & Outdoors filters added');
  }

  // Beauty & Personal Care filters
  const beauty = await categoryRepo.findOne({ where: { slug: 'beauty-personal-care' } });
  if (beauty) {
    beauty.filterConfig = {
      filters: [
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'loreal', label: "L'Oréal" },
            { value: 'maybelline', label: 'Maybelline' },
            { value: 'lakme', label: 'Lakmé' },
            { value: 'nivea', label: 'Nivea' },
            { value: 'dove', label: 'Dove' },
            { value: 'garnier', label: 'Garnier' },
          ],
        },
        {
          id: 'skinType',
          label: 'Skin Type',
          type: 'checkbox',
          options: [
            { value: 'oily', label: 'Oily' },
            { value: 'dry', label: 'Dry' },
            { value: 'combination', label: 'Combination' },
            { value: 'sensitive', label: 'Sensitive' },
            { value: 'normal', label: 'Normal' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 5000,
          step: 100,
        },
      ],
    };
    await categoryRepo.save(beauty);
    console.log('✅ Beauty & Personal Care filters added');
  }

  // Toys & Games filters
  const toys = await categoryRepo.findOne({ where: { slug: 'toys-games' } });
  if (toys) {
    toys.filterConfig = {
      filters: [
        {
          id: 'ageGroup',
          label: 'Age Group',
          type: 'checkbox',
          options: [
            { value: '0-2', label: '0-2 years' },
            { value: '3-5', label: '3-5 years' },
            { value: '6-8', label: '6-8 years' },
            { value: '9-12', label: '9-12 years' },
            { value: '13+', label: '13+ years' },
          ],
        },
        {
          id: 'type',
          label: 'Type',
          type: 'checkbox',
          options: [
            { value: 'educational', label: 'Educational' },
            { value: 'board-game', label: 'Board Game' },
            { value: 'puzzle', label: 'Puzzle' },
            { value: 'action-figure', label: 'Action Figure' },
            { value: 'doll', label: 'Doll' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 10000,
          step: 500,
        },
      ],
    };
    await categoryRepo.save(toys);
    console.log('✅ Toys & Games filters added');
  }

  // Food & Beverages filters
  const food = await categoryRepo.findOne({ where: { slug: 'food-beverages' } });
  if (food) {
    food.filterConfig = {
      filters: [
        {
          id: 'dietary',
          label: 'Dietary',
          type: 'checkbox',
          options: [
            { value: 'organic', label: 'Organic' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'glutenfree', label: 'Gluten Free' },
            { value: 'sugarfree', label: 'Sugar Free' },
            { value: 'keto', label: 'Keto' },
          ],
        },
        {
          id: 'brand',
          label: 'Brand',
          type: 'checkbox',
          options: [
            { value: 'organic-india', label: 'Organic India' },
            { value: 'nestle', label: 'Nestlé' },
            { value: 'amul', label: 'Amul' },
            { value: 'britannia', label: 'Britannia' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 2000,
          step: 50,
        },
      ],
    };
    await categoryRepo.save(food);
    console.log('✅ Food & Beverages filters added');
  }

  // Pet Supplies filters
  const pets = await categoryRepo.findOne({ where: { slug: 'pet-supplies' } });
  if (pets) {
    pets.filterConfig = {
      filters: [
        {
          id: 'petType',
          label: 'Pet Type',
          type: 'checkbox',
          options: [
            { value: 'dog', label: 'Dog' },
            { value: 'cat', label: 'Cat' },
            { value: 'bird', label: 'Bird' },
            { value: 'fish', label: 'Fish' },
          ],
        },
        {
          id: 'category',
          label: 'Product Category',
          type: 'checkbox',
          options: [
            { value: 'food', label: 'Food' },
            { value: 'toys', label: 'Toys' },
            { value: 'accessories', label: 'Accessories' },
            { value: 'health', label: 'Health & Wellness' },
          ],
        },
        {
          id: 'priceRange',
          label: 'Price Range',
          type: 'range',
          min: 0,
          max: 5000,
          step: 100,
        },
      ],
    };
    await categoryRepo.save(pets);
    console.log('✅ Pet Supplies filters added');
  }

  console.log('✅ Category filters seeded successfully!');
}
