import { Controller, Get, Query } from '@nestjs/common';
import { HomepageService } from './homepage.service';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get('data')
  async getHomepageData(
    @Query('cityId') cityId?: string,
    @Query('subLocationId') subLocationId?: string,
  ) {
    return this.homepageService.getHomepageData(cityId, subLocationId);
  }
}
