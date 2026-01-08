import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralTransaction, ReferralTransactionStatus } from './referral-transaction.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { VendorBalance } from '../invoices/vendor-balance.entity';
import { Invoice, InvoiceType, InvoiceStatus } from '../invoices/invoice.entity';
import { SettingsService } from '../admin/settings.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(ReferralTransaction)
    private referralTransactionRepository: Repository<ReferralTransaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorRepository: Repository<Vendor>,
    @InjectRepository(VendorBalance)
    private vendorBalanceRepository: Repository<VendorBalance>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private settingsService: SettingsService,
  ) {}

  /**
   * Generate a unique referral code
   */
  async generateReferralCode(): Promise<string> {
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate 6 character alphanumeric code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
      let randomStr = '';
      for (let i = 0; i < 6; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code = `REF-${randomStr}`;

      // Check if code already exists
      const existing = await this.userRepository.findOne({ where: { referralCode: code } });
      isUnique = !existing;
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique referral code');
    }

    return code;
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(code: string, currentUserId?: string): Promise<User> {
    if (!code || code.trim() === '') {
      throw new BadRequestException('Referral code is required');
    }

    const referrer = await this.userRepository.findOne({
      where: { referralCode: code },
    });

    if (!referrer) {
      throw new NotFoundException('Invalid referral code');
    }

    // Prevent self-referral
    if (currentUserId && referrer.id === currentUserId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    return referrer;
  }

  /**
   * Check if user has reached daily referral limit
   */
  async checkDailyLimit(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get daily limit from settings
    const dailyLimit = await this.settingsService.getSetting('REFERRAL_DAILY_LIMIT');
    const limit = parseInt(dailyLimit?.value || '1', 10);

    // Check if last referral was today
    if (user.lastReferralDate) {
      const today = new Date();
      const lastReferralDate = new Date(user.lastReferralDate);
      
      // If last referral was today, check the count
      if (
        today.getFullYear() === lastReferralDate.getFullYear() &&
        today.getMonth() === lastReferralDate.getMonth() &&
        today.getDate() === lastReferralDate.getDate()
      ) {
        // Count successful referrals today
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const todayCount = await this.referralTransactionRepository.count({
          where: {
            referrerId: userId,
            status: ReferralTransactionStatus.CREDITED,
            creditedAt: Between(todayStart, todayEnd) as any,
          },
        });

        if (todayCount >= limit) {
          return true; // Limit reached
        }
      }
    }

    return false; // Limit not reached
  }

  /**
   * Calculate discounted registration fee
   */
  async calculateDiscountedFee(referralCode?: string): Promise<{
    baseFee: number;
    discount: number;
    finalFee: number;
    referrerId: string | null;
  }> {
    // Get base registration cost from settings
    const costSetting = await this.settingsService.getSetting('VENDOR_REGISTRATION_COST');
    const baseFee = parseFloat(costSetting?.value || '5000');

    if (!referralCode) {
      return {
        baseFee,
        discount: 0,
        finalFee: baseFee,
        referrerId: null,
      };
    }

    // Validate referral code
    const referrer = await this.validateReferralCode(referralCode);

    // Check daily limit
    const limitReached = await this.checkDailyLimit(referrer.id);
    if (limitReached) {
      throw new BadRequestException('Referral limit reached for today. Please try again tomorrow.');
    }

    // Get discount percentage from settings
    const discountSetting = await this.settingsService.getSetting('REFERRAL_PERCENTAGE');
    const discountPercentage = parseFloat(discountSetting?.value || '20');

    const discount = Math.round((baseFee * discountPercentage) / 100);
    const finalFee = baseFee - discount;

    return {
      baseFee,
      discount,
      finalFee,
      referrerId: referrer.id,
    };
  }

  /**
   * Process referral credit after vendor payment
   */
  async processReferralCredit(vendorId: string, registrationInvoiceId: string): Promise<void> {
    this.logger.log(`Processing referral credit for vendor ${vendorId}`);

    const vendor = await this.vendorRepository.findOne({
      where: { id: vendorId },
      relations: ['user'],
    });

    if (!vendor || !vendor.referredBy) {
      this.logger.log('No referrer found for this vendor');
      return;
    }

    const referrer = await this.userRepository.findOne({
      where: { id: vendor.referredBy },
      relations: ['vendor'],
    });

    if (!referrer) {
      throw new NotFoundException('Referrer not found');
    }

    // Calculate credit amount
    const creditPercentageSetting = await this.settingsService.getSetting('REFERRAL_CREDIT_PERCENTAGE');
    const creditPercentage = parseFloat(creditPercentageSetting?.value || '20');
    
    const registrationFee = Number(vendor.registrationFeePaid) || 0;
    const creditAmount = Math.round((registrationFee * creditPercentage) / 100);

    // Create referral transaction record
    const transaction = this.referralTransactionRepository.create({
      referrerId: referrer.id,
      referredVendorId: vendor.id,
      creditAmount,
      registrationInvoiceId,
      status: ReferralTransactionStatus.CREDITED,
      creditedAt: new Date(),
      notes: `Referral credit for vendor registration: ${vendor.storeName}`,
    });

    await this.referralTransactionRepository.save(transaction);

    // Create referral credit invoice
    const registrationInvoice = await this.invoiceRepository.findOne({
      where: { id: registrationInvoiceId },
    });

    const creditInvoice = this.invoiceRepository.create({
      invoiceNumber: `RC-${registrationInvoice?.invoiceNumber || Date.now()}`,
      type: InvoiceType.REFERRAL_CREDIT,
      status: InvoiceStatus.PAID,
      vendorId: vendor.id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      subtotal: creditAmount,
      tax: 0,
      discount: 0,
      total: creditAmount,
      paidAmount: creditAmount,
      paidAt: new Date(),
      notes: `Referral credit for bringing in vendor: ${vendor.storeName}.`,
      terms: `This credit has been added to your ${referrer.role === 'customer' ? 'wallet' : 'vendor balance'}.`,
    });

    await this.invoiceRepository.save(creditInvoice);

    // Credit the referrer based on their role
    if (referrer.role === 'customer') {
      // Credit to wallet balance
      await this.userRepository.update(referrer.id, {
        walletBalance: () => `wallet_balance + ${creditAmount}`,
        referralCreditsEarned: () => `referral_credits_earned + ${creditAmount}`,
        lastReferralDate: new Date(),
      });
      this.logger.log(`Credited ${creditAmount} to customer wallet: ${referrer.email}`);
    } else if (referrer.role === 'vendor_admin' && referrer.vendorId) {
      // Credit to vendor balance
      const vendorBalance = await this.vendorBalanceRepository.findOne({
        where: { vendorId: referrer.vendorId },
      });

      if (vendorBalance) {
        await this.vendorBalanceRepository.update(vendorBalance.id, {
          totalSales: () => `total_sales + ${creditAmount}`,
          pendingPayout: () => `pending_payout + ${creditAmount}`,
        });
      }

      await this.userRepository.update(referrer.id, {
        referralCreditsEarned: () => `referral_credits_earned + ${creditAmount}`,
        lastReferralDate: new Date(),
      });

      this.logger.log(`Credited ${creditAmount} to vendor balance: ${referrer.email}`);
    }

    this.logger.log(`Referral credit processed successfully for ${referrer.email}`);
  }

  /**
   * Get referral stats for a user
   */
  async getReferralStats(userId: string): Promise<{
    code: string;
    totalReferrals: number;
    totalEarned: number;
    pendingCredits: number;
    referrals: ReferralTransaction[];
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const transactions = await this.referralTransactionRepository.find({
      where: { referrerId: userId },
      relations: ['referredVendor'],
      order: { createdAt: 'DESC' },
    });

    const totalEarned = transactions
      .filter(t => t.status === ReferralTransactionStatus.CREDITED)
      .reduce((sum, t) => sum + Number(t.creditAmount), 0);

    const pendingCredits = transactions
      .filter(t => t.status === ReferralTransactionStatus.PENDING)
      .reduce((sum, t) => sum + Number(t.creditAmount), 0);

    return {
      code: user.referralCode || '',
      totalReferrals: transactions.length,
      totalEarned,
      pendingCredits,
      referrals: transactions,
    };
  }
}

// Helper function for date range (TypeORM Between)
function Between(start: Date, end: Date) {
  return {
    $gte: start,
    $lt: end,
  };
}
