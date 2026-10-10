import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { updateProductImages } from './update-product-images';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    await updateProductImages(dataSource);
  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
