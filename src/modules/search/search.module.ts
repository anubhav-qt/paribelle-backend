import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Product } from '../products/product.entity';
import { Category } from '../categories/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
