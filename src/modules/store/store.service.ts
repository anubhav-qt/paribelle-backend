import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from '../admin/settings.service';
import { STORE_ID } from './store.constants';
import { StorePolicy, Vendor } from './vendor.entity';
import { UpdateStoreDto, UpdateStorePoliciesDto } from './dto/update-store.dto';

/** The seller details an order keeps a copy of, as they stood when it was placed. */
export interface SellerSnapshot {
  vendorBusinessName?: string;
  vendorStoreName?: string;
  vendorGstNumber?: string;
  vendorAddress?: string;
  vendorCity?: string;
  vendorState?: string;
  vendorPostalCode?: string;
  vendorCountry?: string;
  vendorContactEmail?: string;
  vendorContactPhone?: string;
}

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Vendor)
    private storeRepository: Repository<Vendor>,
    private settingsService: SettingsService,
  ) {}

  async get(): Promise<Vendor> {
    const store = await this.storeRepository.findOne({ where: { id: STORE_ID } });
    if (!store) {
      // Made by `npm run seed:admin` on a fresh database; no order can be placed without it.
      throw new InternalServerErrorException(`The store row ${STORE_ID} is missing`);
    }
    return store;
  }

  async update(dto: UpdateStoreDto): Promise<Vendor> {
    await this.get();
    const changes = Object.fromEntries(
      Object.entries(dto).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]),
    );
    if (Object.keys(changes).length) {
      await this.storeRepository.update(STORE_ID, changes);
    }
    return this.get();
  }

  async updatePolicies(dto: UpdateStorePoliciesDto): Promise<Vendor> {
    await this.get();
    const changes: Partial<Vendor> = {};
    if (dto.returnPolicy !== undefined) changes.returnPolicy = dto.returnPolicy;
    if (dto.cancellationPolicy !== undefined) changes.cancellationPolicy = dto.cancellationPolicy;
    if (Object.keys(changes).length) {
      await this.storeRepository.update(STORE_ID, changes as any);
    }
    return this.get();
  }

  /** What shoppers see: the store's own policy where it has one, else the shop-wide setting. */
  async policies(): Promise<{ returnPolicy: StorePolicy | null; cancellationPolicy: StorePolicy | null }> {
    const [store, returns, cancellation] = await Promise.all([
      this.get(),
      this.settingsService.getSetting('return_policy'),
      this.settingsService.getSetting('cancellation_policy'),
    ]);
    return {
      returnPolicy: store.returnPolicy ?? parsePolicy(returns),
      cancellationPolicy: store.cancellationPolicy ?? parsePolicy(cancellation),
    };
  }

  async sellerSnapshot(): Promise<SellerSnapshot> {
    const store = await this.get();
    return {
      vendorBusinessName: store.businessName || undefined,
      vendorStoreName: store.storeName || undefined,
      vendorGstNumber: store.gstNumber || undefined,
      vendorAddress: store.address || undefined,
      vendorCity: store.city || undefined,
      vendorState: store.state || undefined,
      vendorPostalCode: store.postalCode || undefined,
      vendorCountry: store.country || 'India',
      vendorContactEmail: store.contactEmail || undefined,
      vendorContactPhone: store.contactPhone || undefined,
    };
  }
}

/** Settings hold policies as JSON text, or as the object itself. */
function parsePolicy(value: unknown): StorePolicy | null {
  if (!value) return null;
  if (typeof value === 'object') return value as StorePolicy;
  try {
    return JSON.parse(String(value)) as StorePolicy;
  } catch {
    return null;
  }
}
