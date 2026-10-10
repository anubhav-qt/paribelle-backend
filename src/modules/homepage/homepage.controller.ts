import { Controller, Get } from '@nestjs/common';
import { HomepageService } from './homepage.service';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Get('data')
  async getHomepageData() {
    return this.homepageService.getHomepageData();
  }
}
