import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplacePagesController } from './marketplace-pages.controller';
import { MarketplacePagesService } from './marketplace-pages.service';
import { MarketplacePage } from './entities/marketplace-page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplacePage])],
  controllers: [MarketplacePagesController],
  providers: [MarketplacePagesService],
  exports: [MarketplacePagesService],
})
export class MarketplacePagesModule {}
