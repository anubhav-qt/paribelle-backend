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

async function checkSlugs() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');
    
    const products = await AppDataSource.query(`
      SELECT id, name, slug, "productType" 
      FROM products 
      WHERE slug IS NULL OR slug = '' OR name ILIKE '%marriage%'
      ORDER BY "createdAt" DESC
      LIMIT 20
    `);
    
    console.log('\nProducts found:', products.length);
    if (products.length > 0) {
      console.log('\nProducts with issues:');
      products.forEach((p: any) => {
        console.log(`- ${p.name} (${p.productType}): slug="${p.slug || 'MISSING'}" id=${p.id}`);
      });
    } else {
      console.log('No products with missing slugs found.');
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSlugs();
