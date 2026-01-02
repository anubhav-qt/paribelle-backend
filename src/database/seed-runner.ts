import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedData } from './seed';
import { DataSource } from 'typeorm';

async function bootstrap() {
  let app;
  
  try {
    // Create application context without HTTP server
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // Disable logging to avoid port conflicts
      abortOnError: false,
    });
    
    const dataSource = app.get(DataSource);
    await seedData(dataSource);
    console.log('✅ Seeding completed');
    
    // Close the application context properly
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('Error details:', error.message);
    
    // Ensure app is closed if it was created
    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        console.error('Error closing app:', closeError.message);
      }
    }
    
    process.exit(1);
  }
}

bootstrap();
