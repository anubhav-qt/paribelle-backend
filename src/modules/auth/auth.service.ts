import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SimpleEmailService } from '../simple-email/simple-email.service';

/** Reset links carry the token; the database keeps only its hash. */
const hashResetToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: SimpleEmailService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // No email-verification gate: a correct password is enough to sign in.
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    return {
      access_token: this.jwtService.sign({ email: user.email, sub: user.id, role: user.role }),
      user,
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
      throw new ConflictException('An account with this email already exists. Please sign in instead.');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Named fields only: the body is an inline type the ValidationPipe can't
    // whitelist, so spreading it would let a signup set `role` or any other
    // column on its own account.
    const user = await this.usersService.create({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      password: hashedPassword,
    });

    // No verification email: signing in doesn't need one, so the new
    // account is signed in straight away, the same as `login`.
    const { password, ...result } = user;

    return {
      message: 'Registration successful!',
      ...(await this.login(result)),
    };
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Ask Google who an OAuth access token belongs to. The token must carry a
   * verified email, and — when GOOGLE_CLIENT_ID is configured here — have
   * been issued to this site's own client, not some other app's.
   */
  async verifyGoogleAccessToken(accessToken: string): Promise<{
    email: string;
    name: string;
    googleId: string;
    picture?: string;
  }> {
    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    const fetchJson = async (url: string, init?: RequestInit) => {
      try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
        return res.ok ? await res.json() : null;
      } catch {
        return null;
      }
    };

    const [tokenInfo, userInfo] = await Promise.all([
      fetchJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`),
      fetchJson('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (!tokenInfo || !userInfo || !userInfo.email || !userInfo.sub) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.aud !== clientId && tokenInfo.azp !== clientId) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    const emailVerified = userInfo.email_verified === true || userInfo.email_verified === 'true';
    if (!emailVerified || tokenInfo.sub !== userInfo.sub) {
      throw new UnauthorizedException('Google sign-in failed. Please try again.');
    }

    return {
      email: String(userInfo.email),
      name: userInfo.name || String(userInfo.email).split('@')[0],
      googleId: String(userInfo.sub),
      picture: userInfo.picture,
    };
  }

  async googleLogin(googleData: {
    email: string;
    name: string;
    googleId: string;
    picture?: string;
  }) {
    let user = await this.usersService.findByEmail(googleData.email);

    if (!user) {
      const [firstName, ...lastNameParts] = googleData.name.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;

      // Nobody knows this password; the account signs in with Google, or
      // sets one through "Forgot password".
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

      user = await this.usersService.create({
        email: googleData.email,
        password: randomPassword,
        firstName,
        lastName,
        emailVerifiedAt: new Date(), // Google has already confirmed this address.
        googleId: googleData.googleId,
      });
    } else if (!user.googleId || !user.emailVerifiedAt) {
      // Signing in with Google is proof of the same address, even for an
      // account that registered with a password.
      await this.usersRepository.update(user.id, {
        googleId: user.googleId || googleData.googleId,
        emailVerifiedAt: user.emailVerifiedAt || new Date(),
      });
    }

    const { password, ...result } = user;
    const { access_token } = await this.login(result);
    return { token: access_token, user: result };
  }

  async forgotPassword(email: string) {
    const user = typeof email === 'string' ? await this.usersService.findByEmail(email.trim()) : null;

    // The same answer either way, so this can't be used to find out who has
    // an account.
    if (!user) return;

    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.usersRepository.update(user.id, {
      passwordResetToken: hashResetToken(resetToken),
      passwordResetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
    } catch (error) {
      this.logger.error(`Failed to send a password reset email: ${error?.message || error}`);
      throw new ServiceUnavailableException(
        'Could not send the reset email right now. Please try again in a few minutes.',
      );
    }
  }

  async resetPassword(token: string, newPassword: string) {
    // The token columns are `select: false`, so they never leave the API in
    // a user object; this lookup asks for the expiry explicitly.
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetTokenExpiry')
      .where('user.passwordResetToken = :token', { token: hashResetToken(String(token ?? '')) })
      .getOne();

    if (!user || !user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired. Please request a new one.');
    }

    await this.usersRepository.update(user.id, {
      password: await bcrypt.hash(newPassword, 10),
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    });
  }
}
