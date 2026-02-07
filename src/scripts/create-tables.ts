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
    
    // Synchronize database schema (create tables)
    console.log('📋 Synchronizing schema...');
    await dataSource.synchronize(false); // false = don't drop existing
    
    console.log('✅ Tables created successfully');
    
    await app.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();
