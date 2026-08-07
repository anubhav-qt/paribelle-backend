import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletLedger } from './wallet-ledger.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WalletLedger, User])],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
