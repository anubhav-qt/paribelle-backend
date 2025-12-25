import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  async getSuggestions(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return { products: [], categories: [], vendors: [] };
    }

    return this.searchService.getSuggestions(query);
  }
}
