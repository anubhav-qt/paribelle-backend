import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

// Parse DATABASE_URL if provided (Render/Heroku style)
let parsedConfig: any = {};
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    parsedConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      username: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  } catch (error) {
    console.error('Warning: Could not parse DATABASE_URL:', error);
  }
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || parsedConfig.host || 'localhost',
  port: parseInt(process.env.DB_PORT || parsedConfig.port || '5432'),
  username: process.env.DB_USERNAME || parsedConfig.username || 'admin',
  password: process.env.DB_PASSWORD || parsedConfig.password || 'admin',
  database: process.env.DB_DATABASE || parsedConfig.database || 'marketplace',
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech') 
    ? { rejectUnauthorized: false } 
    : false,
  entities: [
    process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../**/*.entity.js')
      : path.join(process.cwd(), 'src/**/*.entity{.ts,.js}'),
  ],
  migrations: [
    process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '../migrations/*.js')
      : path.join(process.cwd(), 'src/migrations/*{.ts,.js}'),
  ],
  synchronize: false,
  logging: true,
});
