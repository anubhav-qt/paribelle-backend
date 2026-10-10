import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralTransaction } from './referral-transaction.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { Invoice } from '../invoices/invoice.entity';
import { VendorBalance } from '../invoices/vendor-balance.entity';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferralTransaction,
      User,
      Vendor,
      Invoice,
      VendorBalance,
    ]),
    AdminModule,
  ],
  providers: [ReferralsService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}
