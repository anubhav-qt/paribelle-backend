import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, KYCStatus, KYCDocument } from './vendor.entity';
import { User, UserRole } from '../users/user.entity';

@Injectable()
export class KYCService {
  constructor(
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Submit KYC documents and business details for verification
   */
  async submitKYC(
    vendorId: string, 
    documents: KYCDocument[],
    businessDetails?: {
      businessName?: string;
      panNumber?: string;
      gstRegistrationType?: string;
      gstNumber?: string;
      gstState?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
      bankAccountNumber?: string;
      bankIfscCode?: string;
      bankAccountName?: string;
    }
  ): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Validate required documents
    const requiredTypes = ['pan', 'aadhar_front', 'aadhar_back', 'bank_details', 'address_proof'];
    const submittedTypes = documents.map(d => d.type);
    const missingTypes = requiredTypes.filter(type => !submittedTypes.includes(type));

    if (missingTypes.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingTypes.join(', ')}`
      );
    }

    // Update vendor with KYC documents
    vendor.kycDocuments = documents;
    vendor.kycStatus = KYCStatus.SUBMITTED;
    vendor.kycSubmittedAt = new Date();
    vendor.kycRejectedReason = null; // Clear any previous rejection reason

    // Update business details if provided
    if (businessDetails) {
      if (businessDetails.businessName) {
        vendor.businessName = businessDetails.businessName;
      }
      if (businessDetails.panNumber) {
        vendor.panNumber = businessDetails.panNumber.toUpperCase();
      }
      if (businessDetails.gstRegistrationType) {
        vendor.gstRegistrationType = businessDetails.gstRegistrationType as any;
      }
      if (businessDetails.gstNumber) {
        vendor.gstNumber = businessDetails.gstNumber.toUpperCase();
      }
      if (businessDetails.gstState) {
        vendor.gstState = businessDetails.gstState;
      }
      if (businessDetails.address) {
        vendor.address = businessDetails.address;
      }
      if (businessDetails.city) {
        vendor.city = businessDetails.city;
      }
      if (businessDetails.state) {
        vendor.state = businessDetails.state;
      }
      if (businessDetails.pincode) {
        vendor.pincode = businessDetails.pincode;
      }
      if (businessDetails.bankAccountNumber) {
        vendor.bankAccountNumber = businessDetails.bankAccountNumber;
      }
      if (businessDetails.bankIfscCode) {
        vendor.bankIfscCode = businessDetails.bankIfscCode.toUpperCase();
      }
      if (businessDetails.bankAccountName) {
        vendor.bankAccountName = businessDetails.bankAccountName;
      }
    } else {
      // Fallback: Extract PAN number from document if provided
      const panDoc = documents.find(d => d.type === 'pan');
      if (panDoc?.documentNumber) {
        vendor.panNumber = panDoc.documentNumber.toUpperCase();
      }
    }

    // Extract GST state from GSTIN if not provided
    if (vendor.gstNumber && vendor.gstNumber.length >= 2 && !vendor.gstState) {
      const stateCode = vendor.gstNumber.substring(0, 2);
      const stateCodes: { [key: string]: string } = {
        '27': 'Maharashtra', '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu',
        '36': 'Telangana', '37': 'Andhra Pradesh', '07': 'Delhi', '06': 'Haryana',
        '09': 'Uttar Pradesh', '19': 'West Bengal', '24': 'Gujarat', '08': 'Rajasthan',
      };
      vendor.gstState = stateCodes[stateCode] || `State Code: ${stateCode}`;
    }

    await this.vendorRepository.save(vendor);

    // Send email to admins (simplified - would use email service in production)
    await this.notifyAdminsOfKYCSubmission(vendor);

    return vendor;
  }

  /**
   * Approve vendor KYC
   */
  async approveKYC(vendorId: string, adminUserId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    if (vendor.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    vendor.kycStatus = KYCStatus.APPROVED;
    vendor.isKycVerified = true;
    vendor.kycApprovedAt = new Date();
    vendor.kycApprovedBy = adminUserId;
    vendor.kycRejectedReason = null;

    await this.vendorRepository.save(vendor);

    // Send approval email to vendor
    await this.sendKYCApprovalEmail(vendor);

    return vendor;
  }

  /**
   * Reject vendor KYC with reason
   */
  async rejectKYC(
    vendorId: string,
    reason: string,
    adminUserId: string,
  ): Promise<Vendor> {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    vendor.kycStatus = KYCStatus.REJECTED;
    vendor.isKycVerified = false;
    vendor.kycRejectedReason = reason;

    await this.vendorRepository.save(vendor);

    // Send rejection email to vendor
    await this.sendKYCRejectionEmail(vendor, reason);

    return vendor;
  }

  /**
   * Get all vendors pending KYC review (for admin dashboard)
   */
  async getVendorsForKYCReview(): Promise<Vendor[]> {
    return this.vendorRepository.find({
      where: { kycStatus: KYCStatus.SUBMITTED },
      relations: ['user'],
      order: { kycSubmittedAt: 'ASC' },
    });
  }

  /**
   * Get KYC details for a specific vendor
   */
  async getKYCDetails(vendorId: string): Promise<Vendor> {
    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  /**
   * Validate GSTIN format and extract information
   */
  validateGSTIN(gstin: string): { 
    valid: boolean; 
    state?: string; 
    pan?: string;
    error?: string;
  } {
    if (!gstin || gstin.length !== 15) {
      return { valid: false, error: 'GSTIN must be 15 characters long' };
    }

    // GSTIN format: 22AAAAA0000A1Z5
    // First 2 digits: State code (01-37)
    // Next 10 digits: PAN
    // 13th digit: Entity number (1-9 or alphabet)
    // 14th digit: Z (by default)
    // 15th digit: Check digit

    const stateCode = gstin.substring(0, 2);
    const pan = gstin.substring(2, 12);
    const entityNumber = gstin.charAt(12);
    const zChar = gstin.charAt(13);

    // Validate state code (01-37)
    const stateNum = parseInt(stateCode);
    if (isNaN(stateNum) || stateNum < 1 || stateNum > 37) {
      return { valid: false, error: 'Invalid state code in GSTIN' };
    }

    // Validate PAN format within GSTIN
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      return { valid: false, error: 'Invalid PAN format in GSTIN' };
    }

    // 14th character should typically be 'Z'
    if (zChar !== 'Z' && zChar !== 'z') {
      return { valid: false, error: 'Invalid GSTIN format (14th character)' };
    }

    return {
      valid: true,
      state: stateCode,
      pan: pan,
    };
  }

  /**
   * Notify admins of new KYC submission
   * In production, this would use an email service
   */
  private async notifyAdminsOfKYCSubmission(vendor: Vendor): Promise<void> {
    try {
      // Get all admin users
      const admins = await this.userRepository.find({
        where: { role: UserRole.SUPER_ADMIN },
      });

      const adminUrl = process.env.ADMIN_URL || process.env.FRONTEND_URL;
      const reviewUrl = `${adminUrl}/admin/kyc-verification?vendorId=${vendor.id}`;

      console.log(`[KYC] New submission from vendor: ${vendor.businessName || vendor.storeName}`);
      console.log(`[KYC] Review URL: ${reviewUrl}`);
      console.log(`[KYC] Admins to notify: ${admins.length}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: admin.email,
      //   subject: `New KYC Submission - ${vendor.businessName || vendor.storeName}`,
      //   template: 'kyc-submission-admin',
      //   context: { vendor, reviewUrl }
      // });
    } catch (error) {
      console.error('Error notifying admins:', error);
      // Don't throw error - KYC submission should succeed even if notification fails
    }
  }

  /**
   * Send KYC approval email to vendor
   */
  private async sendKYCApprovalEmail(vendor: Vendor): Promise<void> {
    try {
      console.log(`[KYC] Approval email to: ${vendor.user.email}`);
      console.log(`[KYC] Vendor: ${vendor.businessName || vendor.storeName}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: vendor.user.email,
      //   subject: 'KYC Verification Approved - Your account is now active!',
      //   template: 'kyc-approved',
      //   context: {
      //     vendorName: vendor.businessName || vendor.storeName,
      //     approvedDate: vendor.kycApprovedAt.toLocaleDateString(),
      //   }
      // });
    } catch (error) {
      console.error('Error sending approval email:', error);
    }
  }

  /**
   * Send KYC rejection email to vendor
   */
  private async sendKYCRejectionEmail(vendor: Vendor, reason: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL;
      const resubmitUrl = `${frontendUrl}/vendor/kyc`;

      console.log(`[KYC] Rejection email to: ${vendor.user.email}`);
      console.log(`[KYC] Vendor: ${vendor.businessName || vendor.storeName}`);
      console.log(`[KYC] Reason: ${reason}`);

      // TODO: Send actual email using email service
      // await this.emailService.sendEmail({
      //   to: vendor.user.email,
      //   subject: 'KYC Verification - Additional Information Required',
      //   template: 'kyc-rejected',
      //   context: {
      //     vendorName: vendor.businessName || vendor.storeName,
      //     reason: reason,
      //     resubmitUrl: resubmitUrl,
      //   }
      // });
    } catch (error) {
      console.error('Error sending rejection email:', error);
    }
  }
}
