import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FooterSettingsController } from './footer-settings.controller';
import { FooterSettingsService } from './footer-settings.service';
import { FooterSettings } from './entities/footer-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FooterSettings])],
  controllers: [FooterSettingsController],
  providers: [FooterSettingsService],
  exports: [FooterSettingsService],
})
export class FooterSettingsModule {}
