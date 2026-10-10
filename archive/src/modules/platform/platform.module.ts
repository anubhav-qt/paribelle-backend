import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettings } from './platform-settings.entity';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings])],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformModule {}
