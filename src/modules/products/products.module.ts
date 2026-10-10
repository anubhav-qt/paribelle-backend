import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductVariant, Category]), CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsExcelService],
  exports: [ProductsService, ProductsExcelService],
})
export class ProductsModule {}
