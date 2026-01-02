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
    
    // Force exit after 2 seconds if still hanging
    setTimeout(() => {
      console.log('⚠️  Forcing exit...');
      process.exit(0);
    }, 2000);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await app.close();
    
    // Force exit after 2 seconds
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
}

bootstrap();
