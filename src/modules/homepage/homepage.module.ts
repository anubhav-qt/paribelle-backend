import { Module } from '@nestjs/common';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [CategoriesModule, ProductsModule, AdminModule],
  controllers: [HomepageController],
  providers: [HomepageService],
})
export class HomepageModule {}
