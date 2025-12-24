import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from './address.entity';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  async findAllByUser(userId: string): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Address> {
    const address = await this.addressesRepository.findOne({
      where: { id, userId },
    });
    
    if (!address) {
      throw new NotFoundException(`Address with ID ${id} not found`);
    }
    
    return address;
  }

  async create(userId: string, addressData: Partial<Address>): Promise<Address> {
    // If this is set as default, unset other defaults
    if (addressData.isDefault) {
      await this.addressesRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const address = this.addressesRepository.create({
      ...addressData,
      userId,
    });
    
    return this.addressesRepository.save(address);
  }

  async update(id: string, userId: string, addressData: Partial<Address>): Promise<Address> {
    const address = await this.findOne(id, userId);
    
    // If this is being set as default, unset other defaults
    if (addressData.isDefault && !address.isDefault) {
      await this.addressesRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    await this.addressesRepository.update(id, addressData);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const address = await this.findOne(id, userId);
    await this.addressesRepository.remove(address);
  }
}
