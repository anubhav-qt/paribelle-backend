import { Controller, Post, Body, UseGuards, Request, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  /**
   * The web app does the OAuth code exchange itself (a Next.js route handler
   * talks to Google directly, using GOOGLE_CLIENT_ID/SECRET set in Vercel, not
   * here), then posts the resulting profile to this endpoint. This is the only
   * Google entry point the backend has — `passport-google-oauth20` and its
   * `GET /auth/google` / `GET /auth/google/callback` pair used to exist
   * alongside it, unregistered in any module and unreachable, and were removed
   * rather than left as a second implementation nobody was maintaining.
   */
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
      referralCode?: string;
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgotPassword(email);
    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(
    @Body() body: { token: string; newPassword: string }
  ) {
    await this.authService.resetPassword(body.token, body.newPassword);
    return {
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  }
}
