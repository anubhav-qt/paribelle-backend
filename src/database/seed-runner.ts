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
    
    // Explicitly close database connections
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    
    await app.close();
    
    // Exit immediately after cleanup
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('Error details:', error.message);
    
    // Explicitly close database connections
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    
    await app.close();
    
    // Exit immediately
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error during seeding:', error);
  process.exit(1);
});
