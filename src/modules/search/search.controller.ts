import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  async getSuggestions(@Query('q') query?: string) {
    const q = (query ?? '').trim();
    // Every distinct query is its own cache entry, so a bound keeps a
    // flood of long, random ones from filling the cache.
    if (q.length < 2 || q.length > 80) {
      return { products: [], categories: [] };
    }
    return this.searchService.getSuggestions(q);
  }
}
