import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Product } from '../products/product.entity';
import { ProductVariant } from '../products/product-variant.entity';
import { User } from '../users/user.entity';
import { ReviewsModule } from '../reviews/reviews.module';
import { SimpleEmailModule } from '../simple-email/simple-email.module';
import { StockModule } from '../stock/stock.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, ProductVariant, User]),
    ReviewsModule,
    SimpleEmailModule,
    StockModule,
    PlatformModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => InvoicesModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
