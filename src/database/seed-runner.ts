import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedData } from './seed';
import { DataSource } from 'typeorm';

// Helper to ensure logs are flushed in cloud environments
function log(message: string) {
  console.log(message);
  if (process.stdout.write('')) {
    // Force flush
  }
}

function logError(message: string, error?: any) {
  console.error(message, error || '');
  if (process.stderr.write('')) {
    // Force flush
  }
}

async function bootstrap() {
  let app;
  
  try {
    log('🚀 Starting database seed...');
    
    // Create application context without HTTP server
    log('📦 Creating application context...');
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'], // Only log errors and warnings to reduce noise
      abortOnError: false,
    });
    
    log('🔌 Getting database connection...');
    const dataSource = app.get(DataSource);
    
    log('🌱 Running seed data...');
    await seedData(dataSource);
    
    log('✅ Seeding completed successfully');
    
    // Close the application context properly
    log('🔒 Closing application...');
    await app.close();
    
    log('👋 Seed process finished');
    process.exit(0);
  } catch (error) {
    logError('❌ Seeding failed:', error);
    logError('Error details:', error.message);
    logError('Stack trace:', error.stack);
    
    // Ensure app is closed if it was created
    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        logError('Error closing app:', closeError.message);
      }
    }
    
    process.exit(1);
  }
}

bootstrap();
