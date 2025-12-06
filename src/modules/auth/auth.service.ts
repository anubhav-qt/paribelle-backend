import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { Vendor, VendorStatus } from '../vendors/vendor.entity';
import { SimpleEmailService } from '../simple-email/simple-email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: SimpleEmailService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // Check if email is verified for non-Google users
      if (!user.emailVerifiedAt && !user.email.includes('google')) {
        throw new UnauthorizedException('Please verify your email before logging in. Check your inbox.');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
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
    
    const user = await this.usersService.create({
      ...userData,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
    });
    
    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }
    
    const { password, emailVerificationToken, emailVerificationTokenExpiry, ...result } = user;
    
    return {
      message: 'Registration successful! Please check your email to verify your account.',
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
    // Check if user exists
    let user = await this.usersService.findByEmail(googleData.email);

    if (!user) {
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
        emailVerifiedAt: new Date(), // Auto-verify Google emails
        // You can add googleId and picture to user entity if needed
      });
    } else if (!user.emailVerifiedAt) {
      // If user exists but email not verified, verify it (they used Google)
      user.emailVerifiedAt = new Date();
      await this.usersRepository.save(user);
    }

    const { password, ...result } = user;
    return {
      token: this.jwtService.sign({
        email: result.email,
        sub: result.id,
        role: result.role,
      }),
      user: result,
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

    const user = await this.usersRepository.save({
      email: vendorData.email,
      password: hashedPassword,
      firstName: vendorData.firstName,
      lastName: vendorData.lastName,
      phone: vendorData.phone,
      role: UserRole.VENDOR_ADMIN,
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
    });

    // Link vendor to user
    user.vendorId = vendor.id;
    await this.usersRepository.save(user);

    const { password, ...userResult } = user;
    return {
      message: 'Vendor registration successful. Your account is pending approval.',
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

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, verificationToken);

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }
}
