import { AppDataSource } from '../database/data-source';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('📦 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../../database/migrations/add-vendor-policies.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Applying vendor policies migration...');
    await AppDataSource.query(sql);
    console.log('✅ Migration applied successfully');

    await AppDataSource.destroy();
    console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
