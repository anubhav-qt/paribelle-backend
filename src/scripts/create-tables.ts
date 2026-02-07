import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function createTables() {
  console.log('🏗️  Creating tables from TypeORM entities...');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error'],
    });
    
    const dataSource = app.get(DataSource);
    
    // Synchronize database schema (drop existing + recreate all)
    console.log('📋 Synchronizing schema with dropBeforeSync...');
    await dataSource.synchronize(true); // true = drop existing tables first
    
    console.log('✅ Tables created successfully with all columns');
    
    await app.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createTables();
