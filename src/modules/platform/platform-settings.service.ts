import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings, PlatformKYCStatus } from './platform-settings.entity';
import { UpdatePlatformSettingsDto, CompletePlatformKYCDto } from './dto/platform-settings.dto';

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSettings)
    private platformSettingsRepository: Repository<PlatformSettings>,
  ) {}

  /**
   * Get platform settings (singleton - only one row exists)
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    const settings = await this.platformSettingsRepository.findOne({
      where: {},
      relations: ['kycUpdatedBy', 'settingsUpdatedBy'],
    });

    if (!settings) {
      throw new NotFoundException('Platform settings not found. Please run migrations.');
    }

    return settings;
  }

  /**
   * Update platform settings
   */
  async updatePlatformSettings(
    updateDto: UpdatePlatformSettingsDto,
    updatedByUserId: string,
  ): Promise<PlatformSettings> {
    const settings = await this.getPlatformSettings();

    // Update fields
    Object.assign(settings, updateDto);
    settings.settingsUpdatedAt = new Date();
    settings.settingsUpdatedBy = { id: updatedByUserId } as any;

    // Auto-update KYC status based on completeness
    this.updateKYCStatus(settings);

    return await this.platformSettingsRepository.save(settings);
  }

  /**
   * Complete platform KYC submission
   */
  async completePlatformKYC(
    kycDto: CompletePlatformKYCDto,
    updatedByUserId: string,
  ): Promise<PlatformSettings> {
    const settings = await this.getPlatformSettings();

    // Validate required documents
    const requiredDocTypes = ['pan', 'gst_certificate', 'bank_statement', 'cancelled_cheque'];
    const providedDocTypes = kycDto.kycDocuments.map(doc => doc.type);
    const missingDocs = requiredDocTypes.filter(type => !providedDocTypes.includes(type));

    if (missingDocs.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingDocs.join(', ')}`,
      );
    }

    // Update settings with KYC data
    settings.panNumber = kycDto.panNumber;
    settings.tanNumber = kycDto.tanNumber;
    settings.gstRegistrationType = kycDto.gstRegistrationType;
    settings.gstin = kycDto.gstin;
    settings.gstState = kycDto.gstState;
    settings.bankName = kycDto.bankName;
    settings.bankAccountNumber = kycDto.bankAccountNumber;
    settings.bankIfscCode = kycDto.bankIfscCode;
    settings.bankAccountHolderName = kycDto.bankAccountHolderName;
    settings.kycDocuments = kycDto.kycDocuments.map(doc => ({
      type: doc.type as any,
      documentNumber: doc.documentNumber,
      fileUrl: doc.fileUrl,
      uploadedAt: new Date(doc.uploadedAt),
    }));
    settings.kycStatus = PlatformKYCStatus.COMPLETE;
    settings.kycCompletedAt = new Date();
    settings.kycUpdatedBy = { id: updatedByUserId } as any;
    settings.settingsUpdatedAt = new Date();
    settings.settingsUpdatedBy = { id: updatedByUserId } as any;

    return await this.platformSettingsRepository.save(settings);
  }

  /**
   * Validate GSTIN format
   */
  validateGSTIN(gstin: string): { valid: boolean; state?: string; pan?: string } {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    
    if (!gstinRegex.test(gstin)) {
      return { valid: false };
    }

    // Extract state code and PAN
    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);

    // State code mapping (partial list)
    const stateCodes: { [key: string]: string } = {
      '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
      '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
      '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
      '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
      '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
      '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
      '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
      '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
      '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
      '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
      '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh',
    };

    return {
      valid: true,
      state: stateCodes[stateCode] || `State Code: ${stateCode}`,
      pan: pan,
    };
  }

  /**
   * Check if platform KYC is complete
   */
  async isPlatformKYCComplete(): Promise<boolean> {
    const settings = await this.getPlatformSettings();
    return settings.kycStatus === PlatformKYCStatus.COMPLETE;
  }

  /**
   * Update KYC status based on completeness
   */
  private updateKYCStatus(settings: PlatformSettings): void {
    const hasRequiredBusinessInfo = 
      settings.businessName &&
      settings.businessLegalName &&
      settings.businessType &&
      settings.registeredAddressLine1 &&
      settings.registeredCity &&
      settings.registeredState;

    const hasRequiredTaxInfo = 
      settings.panNumber &&
      settings.gstRegistrationType;

    const hasRequiredBankInfo = 
      settings.bankName &&
      settings.bankAccountNumber &&
      settings.bankIfscCode;

    const hasRequiredDocs = 
      settings.kycDocuments &&
      settings.kycDocuments.length >= 4;

    if (hasRequiredBusinessInfo && hasRequiredTaxInfo && hasRequiredBankInfo && hasRequiredDocs) {
      if (settings.kycStatus !== PlatformKYCStatus.COMPLETE) {
        settings.kycStatus = PlatformKYCStatus.COMPLETE;
        settings.kycCompletedAt = new Date();
      }
    } else if (hasRequiredBusinessInfo || hasRequiredTaxInfo || hasRequiredBankInfo) {
      settings.kycStatus = PlatformKYCStatus.INCOMPLETE;
    } else {
      settings.kycStatus = PlatformKYCStatus.PENDING;
    }
  }

  /**
   * Get platform GSTIN for invoice generation
   */
  async getPlatformGSTIN(): Promise<string | null> {
    const settings = await this.getPlatformSettings();
    return settings.gstin || null;
  }

  /**
   * Get platform commission percentage
   */
  async getCommissionPercentage(): Promise<number> {
    const settings = await this.getPlatformSettings();
    return settings.defaultCommissionPercentage;
  }
}
