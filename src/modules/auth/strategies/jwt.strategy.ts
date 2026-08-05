import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Fetch full user object from database
    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    
    // `emailVerifiedAt` alone is the correct gate — no separate "is this a
    // Google user" exemption is needed, because `AuthService.googleLogin`
    // already sets `emailVerifiedAt` unconditionally on every Google
    // sign-in, at creation and again on login if it was somehow still unset.
    // An earlier version of this check exempted any `@gmail.com` address
    // from verification instead of checking the actual column, which meant
    // registering a Gmail address with a plain password skipped verification
    // entirely — the address never had to prove it belonged to the signer.
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
    }
    
    return user;
  }
}
