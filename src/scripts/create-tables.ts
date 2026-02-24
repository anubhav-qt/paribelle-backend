import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function createTables() {
  console.log('🏗️  Creating tables from TypeORM entities...');
  
  let app;
  
  try {
    // Set a timeout for the entire process
    const timeout = setTimeout(() => {
      console.error('❌ Timeout: Table creation took too long (60s limit)');
      process.exit(1);
    }, 60000); // 60 second timeout
    
    console.log('📦 Creating application context...');
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    
    console.log('🔌 Getting database connection...');
    const dataSource = app.get(DataSource);
    
    // Check if already connected
    if (!dataSource.isInitialized) {
      console.log('🔗 Initializing database connection...');
      await dataSource.initialize();
    }
    
    // Synchronize database schema (drop existing + recreate all)
    console.log('📋 Synchronizing schema (this may take a minute)...');
    await dataSource.synchronize(true); // true = drop existing tables first
    
    console.log('✅ Tables created successfully with all columns');
    
    clearTimeout(timeout);
    
    console.log('🔒 Closing application...');
    await app.close();
    
    console.log('👋 Create tables process finished');
    
    // Force exit after a brief delay to ensure all connections close
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    
    if (app) {
      try {
        await app.close();
      } catch (e) {
        console.error('Error closing app:', e.message);
      }
    }
    
    process.exit(1);
  }
}

createTables();
