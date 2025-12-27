import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadModule } from './modules/upload/upload.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { LocationsModule } from './modules/locations/locations.module';
import { HomepageModule } from './modules/homepage/homepage.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { SimpleEmailModule } from './modules/simple-email/simple-email.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { SearchModule } from './modules/search/search.module';
import { CacheModule } from './modules/cache/cache.module';
import { MarketplacePagesModule } from './modules/marketplace-pages/marketplace-pages.module';
import { FooterSettingsModule } from './modules/footer-settings/footer-settings.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        // If DATABASE_URL exists (Render), use it
        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: configService.get('NODE_ENV') !== 'production',
            logging: configService.get('NODE_ENV') !== 'production',
            dropSchema: false,
            extra: {
              ssl: {
                rejectUnauthorized: false,
              },
              max: 20,
              min: 5,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
            },
          };
        }
        
        // Fallback to individual variables for local development
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST') || 'localhost',
          port: parseInt(configService.get<string>('DB_PORT') || '5432'),
          username: configService.get<string>('DB_USERNAME') || 'admin',
          password: configService.get<string>('DB_PASSWORD') || 'admin',
          database: configService.get<string>('DB_DATABASE') || 'marketplace',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') !== 'production',
          logging: configService.get('NODE_ENV') !== 'production',
          dropSchema: false,
          extra: {
            max: 20,
            min: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          },
        };
      },
      inject: [ConfigService],
    }),

    // Feature modules
    CacheModule, // Cache module first for global availability
    SimpleEmailModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
    CategoriesModule,
    ReviewsModule,
    PromotionsModule,
    AnalyticsModule,
    NotificationsModule,
    UploadModule,
    BookingsModule,
    LocationsModule,
    HomepageModule,
    MonitoringModule,
    AddressesModule,
    SearchModule,
    MarketplacePagesModule,
    FooterSettingsModule,
  ],
})
export class AppModule {}
