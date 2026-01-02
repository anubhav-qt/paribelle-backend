import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedData } from './seed';
import { DataSource } from 'typeorm';

// Force unbuffered output
if ((process.stdout as any)._handle) {
  (process.stdout as any)._handle.setBlocking(true);
}
if ((process.stderr as any)._handle) {
  (process.stderr as any)._handle.setBlocking(true);
}

// Helper to ensure logs are flushed in cloud environments
function log(message: string) {
  process.stdout.write(message + '\n');
}

function logError(message: string, error?: any) {
  process.stderr.write(message + '\n');
  if (error) {
    process.stderr.write(String(error) + '\n');
  }
}

async function bootstrap() {
  let app;
  
  try {
    log('🚀 Starting database seed...');
    
    // Create application context without HTTP server
    log('📦 Creating application context...');
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // Completely disable NestJS logging for cleaner output
      abortOnError: false,
    });
    
    log('🔌 Getting database connection...');
    const dataSource = app.get(DataSource);
    
    // Disable TypeORM query logging during seed
    if (dataSource.options.logging) {
      (dataSource.options as any).logging = false;
    }
    
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
