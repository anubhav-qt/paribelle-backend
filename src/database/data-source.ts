import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

config();

const databaseUrl = process.env.DATABASE_URL;

// When DATABASE_URL is set (Render / Supabase / Heroku style) hand it to `pg`
// verbatim — it parses percent-encoded credentials correctly, whereas a manual
// `new URL()` split silently mangles passwords/usernames that contain reserved
// characters. Discrete DB_* vars are only the local-dev fallback and no longer
// override the URL.
const connection: Record<string, unknown> = databaseUrl
  ? { url: databaseUrl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin',
      database: process.env.DB_DATABASE || 'marketplace',
    };

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connection,
  ssl:
    process.env.NODE_ENV === 'production' ||
    /neon\.tech|supabase\.(com|co)/.test(databaseUrl || '')
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
} as DataSourceOptions);
