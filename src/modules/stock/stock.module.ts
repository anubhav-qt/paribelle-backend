import { Module } from '@nestjs/common';
import { MarketplaceGateway } from './stock.gateway';

@Module({
  providers: [MarketplaceGateway],
  exports: [MarketplaceGateway],
})
export class StockModule {}
