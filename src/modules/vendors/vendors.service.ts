import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Vendor } from './vendor.entity';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { LocationsService } from '../locations/locations.service';
import { City } from '../locations/entities/city.entity';
import { SubLocation } from '../locations/entities/sub-location.entity';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private locationsService: LocationsService,
  ) {}

  async findAll(): Promise<Vendor[]> {
    return this.vendorsRepository.find({
      relations: ['products'],
      order: { storeName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Vendor | null> {
    return this.vendorsRepository.findOne({ 
      where: { id },
      relations: ['locationCity', 'locationSubLocation']
    });
  }

  async findBySlug(slug: string): Promise<Vendor | null> {
    return this.vendorsRepository.findOne({ 
      where: { slug },
      relations: ['products'],
    });
  }

  async getVendorProducts(slug: string): Promise<any> {
    const vendor = await this.vendorsRepository.findOne({ 
      where: { slug },
      relations: ['products'],
    });

    if (!vendor) {
      return { products: [], vendor: null };
    }

    return {
      vendor: {
        id: vendor.id,
        storeName: vendor.storeName,
        slug: vendor.slug,
      },
      products: vendor.products || [],
    };
  }

  async create(vendorData: Partial<Vendor> & { adminEmail?: string; adminPassword?: string }): Promise<Vendor> {
    const { adminEmail, adminPassword, ...vendorInfo } = vendorData;
    
    // Create vendor
    const vendor = this.vendorsRepository.create(vendorInfo);
    await this.vendorsRepository.save(vendor);

    // Create vendor admin user if email and password provided
    if (adminEmail && adminPassword) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: adminEmail },
      });

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const vendorAdmin = this.usersRepository.create({
          email: adminEmail,
          password: hashedPassword,
          firstName: vendor.storeName,
          lastName: 'Admin',
          role: UserRole.VENDOR_ADMIN,
          status: UserStatus.ACTIVE,
          vendorId: vendor.id,
        });

        await this.usersRepository.save(vendorAdmin);
      }
    }

    return vendor;
  }

  async update(id: string, vendorData: Partial<Vendor>): Promise<Vendor | null> {
    const vendor = await this.findOne(id);
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    
    console.log('VendorsService.update - Updating vendor:', id, 'with data:', vendorData);
    
    // Clean up numeric fields - convert empty strings to null
    const cleanedData = { ...vendorData };
    const numericFields = ['shippingCost', 'freeShippingThreshold', 'commissionRate'];
    
    for (const field of numericFields) {
      if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
        delete cleanedData[field];
      } else if (typeof cleanedData[field] === 'string') {
        // Convert string to number
        const num = parseFloat(cleanedData[field] as string);
        if (isNaN(num)) {
          delete cleanedData[field];
        } else {
          cleanedData[field] = num;
        }
      }
    }
    
    console.log('VendorsService.update - Cleaned data:', cleanedData);
    
    const result = await this.vendorsRepository.update(id, cleanedData);
    console.log('VendorsService.update - Update result:', result);
    
    return this.findOne(id);
  }

  async updateVendorLocation(
    vendorId: string,
    locationData: {
      cityId?: string;
      cityName?: string;
      state?: string;
      country?: string;
      subLocationId?: string;
      subLocationName?: string;
      pincode?: string;
      address?: string;
      googlePlaceId?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new Error('Vendor not found');
    }

    let city: City | null = null;
    let subLocation: SubLocation | null = null;

    // Handle city (existing or new)
    if (locationData.cityId) {
      city = await this.locationsService.getCityById(locationData.cityId);
    } else if (locationData.cityName) {
      city = await this.locationsService.findOrCreateCity(
        locationData.cityName,
        locationData.state,
        locationData.country,
      );
    }

    // Handle sublocation (existing or new)
    if (locationData.subLocationId) {
      // If subLocationId is provided, fetch it directly
      const subLocs = city 
        ? await this.locationsService.getSubLocationsByCity(city.id)
        : await this.locationsService.getSubLocationsByCity(locationData.subLocationId);
      
      // Try to find by ID across all sublocations if city not specified
      if (city) {
        const foundSubLocation = subLocs.find(s => s.id === locationData.subLocationId);
        if (foundSubLocation) {
          subLocation = foundSubLocation;
        }
      } else {
        // Get sublocation and infer city from it
        const allCities = await this.locationsService.getAllCities();
        for (const c of allCities) {
          const subs = await this.locationsService.getSubLocationsByCity(c.id);
          const found = subs.find(s => s.id === locationData.subLocationId);
          if (found) {
            subLocation = found;
            city = c;
            break;
          }
        }
      }
    } else if (locationData.subLocationName && city) {
      subLocation = await this.locationsService.findOrCreateSubLocation(
        locationData.subLocationName,
        city.id,
        locationData.pincode,
      );
    }

    // Update vendor
    vendor.locationCity = city;
    vendor.locationSubLocation = subLocation;
    if (locationData.pincode !== undefined) vendor.pincode = locationData.pincode;
    if (locationData.address !== undefined) vendor.address = locationData.address;
    if (locationData.googlePlaceId !== undefined) vendor.googlePlaceId = locationData.googlePlaceId;
    if (locationData.latitude !== undefined) vendor.latitude = locationData.latitude;
    if (locationData.longitude !== undefined) vendor.longitude = locationData.longitude;

    return this.vendorsRepository.save(vendor);
  }

  async remove(id: string): Promise<void> {
    await this.vendorsRepository.delete(id);
  }
}
