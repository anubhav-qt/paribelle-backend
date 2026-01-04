import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { HsnCode } from './hsn-code.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductsService } from './products.service';
import { ProductsExcelService } from './products-excel.service';
import { HsnCodeService } from './hsn-code.service';
import { ProductsController } from './products.controller';
import { HsnCodeController } from './hsn-code.controller';
import { CategoriesModule } from '../categories/categories.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductVariant, HsnCode, Category, Vendor]), CategoriesModule, StockModule],
  controllers: [ProductsController, HsnCodeController],
  providers: [ProductsService, ProductsExcelService, HsnCodeService],
  exports: [ProductsService, ProductsExcelService, HsnCodeService],
})
export class ProductsModule {}
