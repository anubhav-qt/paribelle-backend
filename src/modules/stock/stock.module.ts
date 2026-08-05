import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MarketplaceGateway } from './stock.gateway';

@Module({
  imports: [
    // The gateway verifies the same JWT the REST API uses, so it can put a
    // socket in a room scoped to its owner instead of broadcasting every
    // order event to every connected client — see MarketplaceGateway.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MarketplaceGateway],
  exports: [MarketplaceGateway],
})
export class StockModule {}
