import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedData } from './seed';
import { DataSource } from 'typeorm';

async function bootstrap() {
  // Create application context without HTTP server
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false, // Disable logging to avoid port conflicts
    abortOnError: false,
  });
  
  const dataSource = app.get(DataSource);

  try {
    await seedData(dataSource);
    console.log('✅ Seeding completed');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('Error details:', error.message);
    await app.close();
    process.exit(1);
  }

  // Close the application context properly
  await app.close();
  process.exit(0);
}

bootstrap().catch((error) => {
  console.error('Fatal error during seeding:', error);
  process.exit(1);
});
