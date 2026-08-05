import { Injectable, UnauthorizedException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Vendor, VendorStatus } from '../vendors/vendor.entity';
import { SimpleEmailService } from '../simple-email/simple-email.service';
import { ReferralsService } from '../referrals/referrals.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: SimpleEmailService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private referralsService: ReferralsService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // `emailVerifiedAt` is the whole check — `googleLogin` already sets it
      // unconditionally for Google sign-ins, so nothing else is needed here.
      // This used to also exempt any address containing the substring
      // "google" anywhere, which matched ordinary addresses like
      // "notgoogle@example.com" and let them skip verification entirely.
      if (!user.emailVerifiedAt) {
        throw new UnauthorizedException('Please verify your email before logging in. Check your inbox.');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // For vendor_admin users, fetch their vendor ID
    let vendorId: string | null = null;
    if (user.role === 'vendor_admin') {
      const vendor = await this.vendorsRepository.findOne({
        where: { userId: user.id },
      });
      if (vendor) {
        vendorId = vendor.id;
      }
    }

    const payload = { 
      email: user.email, 
      sub: user.id, 
      role: user.role,
      ...(vendorId && { vendorId })
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...user,
        ...(vendorId && { vendorId }),
      },
    };
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(userData.email);
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24); // 24 hours
    
    // Generate referral code for new user
    const referralCode = await this.referralsService.generateReferralCode();
    
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
      referralCode,
    });
    
    // Send verification email. The account is created either way — a mail
    // outage is not a reason to refuse someone a login — but the caller
    // needs to know it happened, rather than being told to check an inbox
    // that will never receive anything. This used to be swallowed down to a
    // `console.error`, which is exactly why an unconfigured or misconfigured
    // SMTP transport went unnoticed: signup looked identical whether or not
    // the email actually sent.
    let emailSent = true;
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      emailSent = false;
      console.error('Failed to send verification email:', error);
    }

    const { password, emailVerificationToken, emailVerificationTokenExpiry, ...result } = user;

    return {
      message: emailSent
        ? 'Registration successful! Please check your email to verify your account.'
        : 'Registration successful, but we could not send the verification email. ' +
          'Please use "Resend verification email" on the login page, or try again shortly.',
      emailSent,
      user: result,
    };
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async googleLogin(googleData: {
    email: string;
    name: string;
    googleId: string;
    picture?: string;
  }) {
    console.log('[GoogleLogin] Attempting login for:', googleData.email);
    
    // Check if user exists
    let user = await this.usersService.findByEmail(googleData.email);

    if (!user) {
      console.log('[GoogleLogin] User not found, creating new user');
      // Create new user from Google data
      const [firstName, ...lastNameParts] = googleData.name.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;

      // Generate a random password for Google users
      const randomPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-8),
        10,
      );

      user = await this.usersService.create({
        email: googleData.email,
        password: randomPassword,
        firstName,
        lastName,
        emailVerifiedAt: new Date(), // Google has already confirmed this address.
        googleId: googleData.googleId,
      });
      console.log('[GoogleLogin] New user created successfully');
    } else {
      console.log('[GoogleLogin] Existing user found');
      // Record the Google id and verify the email even for an account that
      // originally registered with a password — signing in with Google here
      // is proof of the same address, and `JwtStrategy` needs `googleId` set
      // to exempt this user from the verification gate on future logins.
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleData.googleId;
        changed = true;
      }
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        changed = true;
      }
      if (changed) {
        await this.usersRepository.save(user);
        console.log('[GoogleLogin] Updated googleId/emailVerifiedAt for existing user');
      }
    }

    const { password, ...result } = user;
    
    // For vendor_admin users, fetch their vendor ID
    let vendorId: string | null = null;
    if (result.role === 'vendor_admin') {
      const vendor = await this.vendorsRepository.findOne({
        where: { userId: result.id },
      });
      if (vendor) {
        vendorId = vendor.id;
      }
    }
    
    const token = this.jwtService.sign({
      email: result.email,
      sub: result.id,
      role: result.role,
      ...(vendorId && { vendorId }),
    });
    
    console.log('[GoogleLogin] Login successful, returning token and user');
    return {
      token,
      user: {
        ...result,
        ...(vendorId && { vendorId }),
      },
    };
  }

  async registerVendor(vendorData: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone: string;
    storeName: string;
    description?: string;
    businessName?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    isGoogleAuth?: boolean;
    referralCode?: string;
  }) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(vendorData.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check if store name already exists
    const existingStore = await this.vendorsRepository.findOne({
      where: { storeName: vendorData.storeName },
    });
    if (existingStore) {
      throw new BadRequestException('Store name already taken');
    }

    // Process referral code if provided
    let referrerId: string | null = null;
    let registrationDiscount = 0;
    if (vendorData.referralCode) {
      const feeData = await this.referralsService.calculateDiscountedFee(
        vendorData.referralCode,
      );
      referrerId = feeData.referrerId;
      registrationDiscount = feeData.discount;
    }

    // Create user account
    let hashedPassword: string;
    if (vendorData.isGoogleAuth) {
      // Generate random password for Google users
      hashedPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-8),
        10,
      );
    } else {
      if (!vendorData.password) {
        throw new BadRequestException('Password is required');
      }
      hashedPassword = await bcrypt.hash(vendorData.password, 10);
    }

    // Generate referral code for the new vendor
    const referralCode = await this.referralsService.generateReferralCode();

    const user = await this.usersRepository.save({
      email: vendorData.email,
      password: hashedPassword,
      firstName: vendorData.firstName,
      lastName: vendorData.lastName,
      phone: vendorData.phone,
      role: UserRole.VENDOR_ADMIN,
      referralCode,
      referredBy: referrerId || undefined,
    });

    // Create vendor/store
    const slug = vendorData.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const vendor = await this.vendorsRepository.save({
      storeName: vendorData.storeName,
      slug,
      description: vendorData.description,
      businessName: vendorData.businessName,
      contactEmail: vendorData.email,
      contactPhone: vendorData.phone,
      address: vendorData.address,
      city: vendorData.city,
      state: vendorData.state,
      country: vendorData.country,
      postalCode: vendorData.postalCode,
      status: VendorStatus.PENDING,
      userId: user.id,
      referredBy: referrerId || undefined,
      referralDiscount: registrationDiscount,
    });

    // Link vendor to user
    user.vendorId = vendor.id;
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.usersRepository.save(user);

    // Send verification email - CRITICAL: Must succeed for registration to complete
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
      this.logger.log(`Verification email sent to vendor: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to vendor ${user.email}:`, error);
      // Rollback: Delete vendor and user since verification email failed
      await this.vendorsRepository.delete(vendor.id);
      await this.usersRepository.delete(user.id);
      throw new BadRequestException(
        'Failed to send verification email. Please check your email address and try again, or contact support if the problem persists.',
      );
    }

    // Send vendor welcome email - non-critical, can fail without affecting registration
    try {
      await this.emailService.sendVendorWelcomeEmail(
        user.email,
        vendorData.firstName,
        vendor.storeName,
      );
      this.logger.log(`Welcome email sent to vendor: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to vendor ${user.email}:`, error);
      // Don't fail registration if welcome email fails
    }

    const { password, ...userResult } = user;
    return {
      message: 'Vendor registration successful. Your account is pending approval. Please check your email to verify your account.',
      vendor: {
        id: vendor.id,
        storeName: vendor.storeName,
        status: vendor.status,
      },
      user: userResult,
      token: this.jwtService.sign({
        email: userResult.email,
        sub: userResult.id,
        role: userResult.role,
        vendorId: vendor.id,
      }),
    };
  }

  async verifyEmailToken(token: string) {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.emailVerificationTokenExpiry || user.emailVerificationTokenExpiry < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Mark email as verified
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;
    await this.usersRepository.save(user);

    return {
      message: 'Email verified successfully! You can now login.',
      verified: true,
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpiry = verificationTokenExpiry;
    await this.usersRepository.save(user);

    // Send verification email. Unlike `register`, there is no account
    // creation to protect here — if the email genuinely can't be sent, the
    // caller needs to know, not receive a false "check your inbox". But the
    // failure should read as "the mail provider is down", a 503, not an
    // unhandled crash presenting as a generic 500 with no explanation.
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      throw new ServiceUnavailableException(
        'Could not send the verification email right now. Please try again in a few minutes.',
      );
    }

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return {
        message: 'If an account exists with that email, a password reset link has been sent.',
      };
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpiry = resetTokenExpiry;
    await this.usersRepository.save(user);

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (!user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetTokenExpiry = null;
    await this.usersRepository.save(user);

    return {
      message: 'Password has been reset successfully.',
    };
  }
}
