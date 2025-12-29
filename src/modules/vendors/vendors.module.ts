import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendor } from './vendor.entity';
import { User } from '../users/user.entity';
import { VendorPage } from './entities/vendor-page.entity';
import { VendorBlogPost } from './entities/vendor-blog-post.entity';
import { VendorNavigation } from './entities/vendor-navigation.entity';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { VendorPagesController } from './vendor-pages.controller';
import { VendorPagesService } from './vendor-pages.service';
import { KYCController } from './kyc.controller';
import { KYCService } from './kyc.service';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, User, VendorPage, VendorBlogPost, VendorNavigation]),
    LocationsModule,
  ],
  controllers: [VendorsController, VendorPagesController, KYCController],
  providers: [VendorsService, VendorPagesService, KYCService],
  exports: [VendorsService, VendorPagesService, KYCService],
})
export class VendorsModule {}
