import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as path from 'path';

/**
 * Reset database - drops all tables and recreates from entities
 * This is more reliable than SQL scripts as it uses the actual entity definitions
 */
async function resetDatabase() {
  const args = process.argv.slice(2);
  const forceMode = args.includes('--force') || args.includes('-f');

  console.log('🔄 Resetting database...\n');

  try {
    // Create a new DataSource with snake_case naming strategy for proper column names
    const resetDataSource = new DataSource({
      ...AppDataSource.options,
      namingStrategy: new SnakeNamingStrategy(),
      synchronize: false, // We'll call synchronize manually
    });

    // Initialize connection
    console.log('📦 Connecting to database...');
    await resetDataSource.initialize();
    console.log('✅ Connected\n');

    if (forceMode) {
      console.log('🔥 --force flag detected. Dropping all tables...');
      
      // Drop all tables
      console.log('🗑️  Dropping all tables...');
      await resetDataSource.dropDatabase();
      console.log('✅ All tables dropped\n');

      // Recreate from entities (synchronize)
      console.log('🔧 Creating tables from entities...');
      await resetDataSource.synchronize();
      console.log('✅ All tables created\n');
    } else {
      console.log('🔧 Updating schema (adding new columns/tables, keeping existing data)...');
      await resetDataSource.synchronize();
      console.log('✅ Schema updated\n');
    }

    // Skip migrations since synchronize already created all tables with proper snake_case naming
    console.log('⏭️  Skipping migrations (tables already created via synchronize)\n');

    console.log('✅ Database reset complete!\n');
    
    await resetDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase();
