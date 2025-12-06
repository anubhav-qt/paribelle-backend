import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { City } from './entities/city.entity';
import { SubLocation } from './entities/sub-location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(City)
    private cityRepository: Repository<City>,
    @InjectRepository(SubLocation)
    private subLocationRepository: Repository<SubLocation>,
  ) {}

  async getAllCities(): Promise<City[]> {
    return this.cityRepository.find({
      relations: ['subLocations'],
      order: { name: 'ASC' },
    });
  }

  async getCityById(id: string): Promise<City | null> {
    return this.cityRepository.findOne({
      where: { id },
      relations: ['subLocations'],
    });
  }

  async getSubLocationsByCity(cityId: string): Promise<SubLocation[]> {
    return this.subLocationRepository.find({
      where: { city: { id: cityId } },
      order: { name: 'ASC' },
    });
  }

  async searchCities(query: string): Promise<City[]> {
    return this.cityRepository.find({
      where: { name: ILike(`%${query}%`) },
      order: { name: 'ASC' },
    });
  }

  async searchSubLocations(cityId: string, query: string): Promise<SubLocation[]> {
    return this.subLocationRepository.find({
      where: {
        city: { id: cityId },
        name: ILike(`%${query}%`),
      },
      order: { name: 'ASC' },
    });
  }

  async getCityByName(name: string): Promise<City | null> {
    return this.cityRepository.findOne({
      where: { name: ILike(name) },
    });
  }

  async getSubLocationByNameAndCity(
    name: string,
    cityId: string,
  ): Promise<SubLocation | null> {
    return this.subLocationRepository.findOne({
      where: {
        name: ILike(name),
        city: { id: cityId },
      },
    });
  }

  async createCity(name: string, state?: string, country?: string, isUserCreated: boolean = false): Promise<City> {
    const city = this.cityRepository.create({ name, state, country: country || 'India', isUserCreated });
    return this.cityRepository.save(city);
  }

  async createSubLocation(
    name: string,
    cityId: string,
    zipCode?: string,
  ): Promise<SubLocation> {
    const city = await this.cityRepository.findOne({ where: { id: cityId } });
    if (!city) {
      throw new Error('City not found');
    }
    const subLocation = this.subLocationRepository.create({
      name,
      city,
      zipCode,
    });
    return this.subLocationRepository.save(subLocation);
  }

  async findOrCreateCity(
    name: string,
    state?: string,
    country?: string,
  ): Promise<City> {
    const existing = await this.getCityByName(name);
    if (existing) {
      return existing;
    }
    return this.createCity(name, state, country, true);
  }

  async findOrCreateSubLocation(
    name: string,
    cityId: string,
    zipCode?: string,
  ): Promise<SubLocation> {
    const existing = await this.getSubLocationByNameAndCity(name, cityId);
    if (existing) {
      return existing;
    }
    
    const city = await this.cityRepository.findOne({ where: { id: cityId } });
    if (!city) {
      throw new Error('City not found');
    }
    
    const subLocation = this.subLocationRepository.create({
      name,
      city,
      zipCode,
      isUserCreated: true,
    });
    return this.subLocationRepository.save(subLocation);
  }

  async deleteCity(id: string): Promise<void> {
    await this.cityRepository.delete(id);
  }

  async deleteSubLocation(id: string): Promise<void> {
    await this.subLocationRepository.delete(id);
  }
}
