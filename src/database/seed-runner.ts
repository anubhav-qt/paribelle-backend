import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedData } from './seed';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  try {
    await seedData(dataSource);
    console.log('✅ Seeding completed');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await app.close();
    process.exit(1);
  }
}

bootstrap();
