import { Controller, Post, Body, UseGuards, Request, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto, GoogleLoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

/**
 * Ten tries a minute per visitor for anything that checks a password or
 * sends an email — the global 100/min is plenty for guessing passwords.
 */
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_LIMIT)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @Throttle(AUTH_LIMIT)
  @ApiOperation({ summary: 'Login user' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  /**
   * The web app does the OAuth code exchange itself (a Next.js route handler
   * talks to Google), then posts Google's access token here. No tighter
   * limit: these arrive relayed through the web server, so they would all
   * share one bucket, and a token only works once Google has vouched for it.
   */
  @Post('google-login')
  @ApiOperation({ summary: 'Login/Register user via Google OAuth' })
  async googleLogin(@Body() body: GoogleLoginDto) {
    // Only Google's answer for this token says who is signing in.
    const profile = await this.authService.verifyGoogleAccessToken(body.accessToken);
    return this.authService.googleLogin(profile);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getCurrentUser(@Request() req) {
    const { password, ...user } = req.user;
    return user;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_LIMIT)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_LIMIT)
  @ApiOperation({ summary: 'Reset password with token' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.newPassword);
    return {
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  }
}
