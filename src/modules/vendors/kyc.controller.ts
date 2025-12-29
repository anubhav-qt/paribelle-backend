import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { KYCService } from './kyc.service';
import { KYCDocument } from './vendor.entity';
import { UserRole } from '../users/user.entity';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  /**
   * Submit KYC documents and business details for verification
   * POST /api/v1/vendors/kyc/submit
   */
  @Post('kyc/submit')
  @HttpCode(HttpStatus.OK)
  async submitKYC(
    @Request() req,
    @Body() body: { 
      documents: KYCDocument[];
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
    },
  ) {
    const vendorId = req.user.vendorId;
    
    if (!vendorId) {
      return {
        success: false,
        message: 'Vendor ID not found in user session',
      };
    }

    const vendor = await this.kycService.submitKYC(vendorId, body.documents, {
      businessName: body.businessName,
      panNumber: body.panNumber,
      gstRegistrationType: body.gstRegistrationType,
      gstNumber: body.gstNumber,
      gstState: body.gstState,
      address: body.address,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      bankAccountNumber: body.bankAccountNumber,
      bankIfscCode: body.bankIfscCode,
      bankAccountName: body.bankAccountName,
    });
    
    return {
      success: true,
      message: 'KYC documents submitted successfully. You will be notified once verified.',
      data: {
        kycStatus: vendor.kycStatus,
        kycSubmittedAt: vendor.kycSubmittedAt,
      },
    };
  }

  /**
   * Get KYC status for current vendor
   * GET /api/v1/vendors/kyc/status
   */
  @Get('kyc/status')
  async getKYCStatus(@Request() req) {
    const vendorId = req.user.vendorId;
    
    if (!vendorId) {
      return {
        success: false,
        message: 'Vendor ID not found',
      };
    }

    const vendor = await this.kycService.getKYCDetails(vendorId);
    
    return {
      success: true,
      data: {
        kycStatus: vendor.kycStatus,
        kycDocuments: vendor.kycDocuments,
        kycSubmittedAt: vendor.kycSubmittedAt,
        kycApprovedAt: vendor.kycApprovedAt,
        kycRejectedReason: vendor.kycRejectedReason,
        isKycVerified: vendor.isKycVerified,
        // Business details for form population
        businessName: vendor.businessName,
        panNumber: vendor.panNumber,
        gstRegistrationType: vendor.gstRegistrationType,
        gstNumber: vendor.gstNumber,
        gstState: vendor.gstState,
        address: vendor.address,
        city: vendor.city,
        state: vendor.state,
        pincode: vendor.pincode,
        bankAccountNumber: vendor.bankAccountNumber,
        bankIfscCode: vendor.bankIfscCode,
        bankAccountName: vendor.bankAccountName,
      },
    };
  }

  /**
   * Get all pending KYC submissions (Admin only)
   * GET /api/v1/vendors/kyc/pending
   */
  @Get('kyc/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getPendingKYC() {
    const vendors = await this.kycService.getVendorsForKYCReview();
    
    return {
      success: true,
      count: vendors.length,
      data: vendors.map(vendor => ({
        id: vendor.id,
        businessName: vendor.businessName,
        storeName: vendor.storeName,
        email: vendor.user?.email,
        kycStatus: vendor.kycStatus,
        kycSubmittedAt: vendor.kycSubmittedAt,
        kycDocuments: vendor.kycDocuments,
        panNumber: vendor.panNumber,
        gstNumber: vendor.gstNumber,
        gstRegistrationType: vendor.gstRegistrationType,
      })),
    };
  }

  /**
   * Get KYC details for specific vendor (Admin only)
   * GET /api/v1/vendors/kyc/:vendorId
   */
  @Get('kyc/:vendorId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getVendorKYC(@Param('vendorId') vendorId: string) {
    const vendor = await this.kycService.getKYCDetails(vendorId);
    
    return {
      success: true,
      data: {
        id: vendor.id,
        businessName: vendor.businessName,
        storeName: vendor.storeName,
        email: vendor.user?.email,
        contactPhone: vendor.contactPhone,
        address: vendor.address,
        kycStatus: vendor.kycStatus,
        kycDocuments: vendor.kycDocuments,
        kycSubmittedAt: vendor.kycSubmittedAt,
        kycApprovedAt: vendor.kycApprovedAt,
        kycRejectedReason: vendor.kycRejectedReason,
        panNumber: vendor.panNumber,
        gstNumber: vendor.gstNumber,
        gstRegistrationType: vendor.gstRegistrationType,
        isKycVerified: vendor.isKycVerified,
      },
    };
  }

  /**
   * Approve vendor KYC (Admin only)
   * PUT /api/v1/vendors/kyc/:vendorId/approve
   */
  @Put('kyc/:vendorId/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveKYC(@Param('vendorId') vendorId: string, @Request() req) {
    const adminUserId = req.user.id;
    const vendor = await this.kycService.approveKYC(vendorId, adminUserId);
    
    return {
      success: true,
      message: 'KYC approved successfully. Vendor has been notified.',
      data: {
        vendorId: vendor.id,
        kycStatus: vendor.kycStatus,
        kycApprovedAt: vendor.kycApprovedAt,
        isKycVerified: vendor.isKycVerified,
      },
    };
  }

  /**
   * Reject vendor KYC with reason (Admin only)
   * PUT /api/v1/vendors/kyc/:vendorId/reject
   */
  @Put('kyc/:vendorId/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectKYC(
    @Param('vendorId') vendorId: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    const adminUserId = req.user.id;
    const vendor = await this.kycService.rejectKYC(
      vendorId,
      body.reason,
      adminUserId,
    );
    
    return {
      success: true,
      message: 'KYC rejected. Vendor has been notified to resubmit documents.',
      data: {
        vendorId: vendor.id,
        kycStatus: vendor.kycStatus,
        kycRejectedReason: vendor.kycRejectedReason,
      },
    };
  }

  /**
   * Validate GSTIN format
   * POST /api/v1/vendors/kyc/validate-gstin
   */
  @Post('kyc/validate-gstin')
  @HttpCode(HttpStatus.OK)
  async validateGSTIN(@Body() body: { gstin: string }) {
    const result = this.kycService.validateGSTIN(body.gstin);
    
    return {
      success: result.valid,
      ...result,
    };
  }
}
