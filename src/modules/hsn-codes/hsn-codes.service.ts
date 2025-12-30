import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { HsnCode } from './hsn-code.entity';

export interface CreateHsnCodeDto {
  code: string;
  description: string;
  gstRate: number;
  category?: string;
}

export interface UpdateHsnCodeDto {
  description?: string;
  gstRate?: number;
  category?: string;
}

@Injectable()
export class HsnCodesService {
  constructor(
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
  ) {}

  async findAll(): Promise<HsnCode[]> {
    return await this.hsnCodeRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async findByCode(code: string): Promise<HsnCode | null> {
    return await this.hsnCodeRepository.findOne({
      where: { code, isActive: true },
    });
  }

  async create(data: CreateHsnCodeDto): Promise<HsnCode> {
    const hsnCode = this.hsnCodeRepository.create({
      code: data.code,
      description: data.description,
      recommendedGstRate: data.gstRate,
      category: data.category,
      isActive: true,
    });
    return await this.hsnCodeRepository.save(hsnCode);
  }

  async update(id: string, data: UpdateHsnCodeDto): Promise<HsnCode> {
    const hsnCode = await this.hsnCodeRepository.findOne({ where: { id } });
    if (!hsnCode) {
      throw new Error('HSN code not found');
    }

    if (data.description !== undefined) {
      hsnCode.description = data.description;
    }
    if (data.gstRate !== undefined) {
      hsnCode.recommendedGstRate = data.gstRate;
    }
    if (data.category !== undefined) {
      hsnCode.category = data.category;
    }

    return await this.hsnCodeRepository.save(hsnCode);
  }

  async delete(id: string): Promise<void> {
    await this.hsnCodeRepository.delete(id);
  }

  async search(query: string): Promise<HsnCode[]> {
    const searchPattern = `%${query.toLowerCase()}%`;
    
    return await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = :isActive', { isActive: true })
      .andWhere(
        '(LOWER(hsn.code) LIKE :search OR LOWER(hsn.description) LIKE :search)',
        { search: searchPattern }
      )
      .orderBy('hsn.code', 'ASC')
      .getMany();
  }
}
