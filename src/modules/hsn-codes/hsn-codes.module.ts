import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { HsnCodesController } from './hsn-codes.controller';
import { HsnCodesService } from './hsn-codes.service';
import { HsnCode } from './hsn-code.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HsnCode]),
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  ],
  controllers: [HsnCodesController],
  providers: [HsnCodesService],
  exports: [HsnCodesService],
})
export class HsnCodesModule {}
