import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    await AppDataSource.initialize();
    console.log('Connected to database');

    const sql = fs.readFileSync(
      path.join(__dirname, '../database/migrations/add-policies-settings.sql'),
      'utf-8'
    );

    await AppDataSource.query(sql);
    console.log('✅ Policies settings migration completed');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
