import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Return } from './return.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ExchangesService } from './exchanges.service';
import { ExchangesController } from './exchanges.controller';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { User } from '../users/user.entity';
import { ReviewsModule } from '../reviews/reviews.module';
import { StockModule } from '../stock/stock.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PlatformModule } from '../platform/platform.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Return, Product, ProductVariant, User]),
    ReviewsModule,
    StockModule,
    PlatformModule,
    AdminModule,
    NotificationsModule,
    WalletModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => InvoicesModule),
  ],
  controllers: [OrdersController, ExchangesController],
  providers: [OrdersService, ExchangesService],
  exports: [OrdersService, ExchangesService],
})
export class OrdersModule {}
