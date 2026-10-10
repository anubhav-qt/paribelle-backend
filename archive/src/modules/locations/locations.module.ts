import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { City } from './entities/city.entity';
import { SubLocation } from './entities/sub-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([City, SubLocation])],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
