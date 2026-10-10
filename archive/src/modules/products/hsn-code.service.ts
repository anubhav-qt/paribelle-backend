import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { HsnCode } from './hsn-code.entity';

@Injectable()
export class HsnCodeService {
  constructor(
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
  ) {}

  /**
   * Search HSN codes by code or description
   */
  async searchHsnCodes(query: string, limit: number = 10): Promise<HsnCode[]> {
    if (!query || query.length < 2) {
      return [];
    }

    return this.hsnCodeRepository.find({
      where: [
        { code: Like(`${query}%`), isActive: true },
        { description: Like(`%${query}%`), isActive: true },
      ],
      take: limit,
      order: { code: 'ASC' },
    });
  }

  /**
   * Get HSN code by exact code
   */
  async getByCode(code: string): Promise<HsnCode | null> {
    return this.hsnCodeRepository.findOne({
      where: { code, isActive: true },
    });
  }

  /**
   * Get all HSN codes by category
   */
  async getByCategory(category: string): Promise<HsnCode[]> {
    return this.hsnCodeRepository.find({
      where: { category, isActive: true },
      order: { code: 'ASC' },
    });
  }

  /**
   * Get recommended GST rate for an HSN code
   */
  async getRecommendedGstRate(hsnCode: string): Promise<number | null> {
    const hsn = await this.getByCode(hsnCode);
    return hsn ? Number(hsn.recommendedGstRate) : null;
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    const result = await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .select('DISTINCT hsn.category', 'category')
      .where('hsn.isActive = :isActive', { isActive: true })
      .andWhere('hsn.category IS NOT NULL')
      .getRawMany();

    return result.map(r => r.category).sort();
  }

  /**
   * Get all HSN codes (for admin)
   */
  async getAllHsnCodes(): Promise<HsnCode[]> {
    return this.hsnCodeRepository.find({
      order: { category: 'ASC', code: 'ASC' },
    });
  }

  /**
   * Validate HSN code format
   */
  validateHsnCode(code: string): { valid: boolean; message?: string } {
    if (!code) {
      return { valid: false, message: 'HSN code is required' };
    }

    // HSN codes are typically 4, 6, or 8 digits
    const cleanCode = code.replace(/\s/g, '');
    
    if (!/^\d{4,8}$/.test(cleanCode)) {
      return { 
        valid: false, 
        message: 'HSN code must be 4-8 digits' 
      };
    }

    return { valid: true };
  }

  /**
   * Suggest HSN codes based on product name/description
   */
  async suggestHsnCode(productName: string, description?: string): Promise<HsnCode[]> {
    const keywords = (productName + ' ' + (description || ''))
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    if (keywords.length === 0) {
      return [];
    }

    const suggestions = await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = :isActive', { isActive: true })
      .andWhere(
        keywords.map((_, i) => `LOWER(hsn.description) LIKE :keyword${i}`).join(' OR '),
        keywords.reduce((acc, keyword, i) => {
          acc[`keyword${i}`] = `%${keyword}%`;
          return acc;
        }, {}),
      )
      .limit(5)
      .getMany();

    return suggestions;
  }
}
