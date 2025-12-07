import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

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
import { AppResolver } from './app.resolver';

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
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        
        // If DATABASE_URL exists (Render), use it
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: true,
            dropSchema: false,
            ssl: {
              rejectUnauthorized: false,
            },
            extra: {
              max: 20,
              min: 5,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 10000,
            },
          };
        }
        
        // Fallback to individual variables for local development
        return {
          type: 'postgres',
          host: configService.get('DB_HOST') || 'localhost',
          port: parseInt(configService.get('DB_PORT') || '5432'),
          username: configService.get('DB_USERNAME') || 'admin',
          password: configService.get('DB_PASSWORD') || 'admin',
          database: configService.get('DB_DATABASE') || 'marketplace',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: true,
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
      },
      inject: [ConfigService],
    }),

    // GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),

    // Feature modules
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
  ],
  providers: [AppResolver],
})
export class AppModule {}
