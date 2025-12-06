import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'marketplace',
  synchronize: false,
  logging: false,
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fixSlugs() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');
    
    // Find products with missing slugs
    const products = await AppDataSource.query(`
      SELECT id, name, slug
      FROM products 
      WHERE slug IS NULL OR slug = ''
    `);
    
    console.log(`\nFound ${products.length} products with missing slugs`);
    
    for (const product of products) {
      const newSlug = generateSlug(product.name);
      console.log(`Updating "${product.name}" with slug: "${newSlug}"`);
      
      await AppDataSource.query(
        `UPDATE products SET slug = $1 WHERE id = $2`,
        [newSlug, product.id]
      );
    }
    
    console.log('\nAll slugs updated successfully!');
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

fixSlugs();
