import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('google-login')
  @ApiOperation({ summary: 'Login/Register user via Google OAuth' })
  async googleLogin(
    @Body()
    body: {
      email: string;
      name: string;
      googleId: string;
      picture?: string;
    },
  ) {
    return this.authService.googleLogin(body);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Request() req) {
    return this.authService.googleLogin({
      email: req.user.email,
      name: `${req.user.firstName} ${req.user.lastName}`,
      googleId: req.user.googleId,
      picture: req.user.picture,
    });
  }

  @Post('register-vendor')
  @ApiOperation({ summary: 'Register a new vendor/store' })
  async registerVendor(
    @Body()
    body: {
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
    },
  ) {
    return this.authService.registerVendor(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getCurrentUser(@Request() req) {
    const { password, ...user } = req.user;
    return user;
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email with token' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmailToken(token);
    return {
      message: 'Email verified successfully. You can now login.',
    };
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return {
      message: 'Verification email sent. Please check your inbox.',
    };
  }
}
