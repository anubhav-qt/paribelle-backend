import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DataSource } from 'typeorm';

async function check() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ds = app.get(DataSource);
  
  const count = await ds.query('SELECT COUNT(*) FROM products');
  console.log('Total products:', count[0].count);
  
  const sampleProducts = await ds.query('SELECT name, slug, images FROM products LIMIT 5');
  console.log('\nSample products with images:');
  sampleProducts.forEach(p => {
    const imageCount = p.images ? p.images.split(',').length : 0;
    console.log(`- ${p.name}: ${imageCount} images`);
  });
  
  await app.close();
}

check();
