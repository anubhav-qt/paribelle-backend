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
    
    // Check if email is verified for non-Google users
    if (!user.emailVerifiedAt && !user.email.includes('google')) {
      throw new UnauthorizedException('Please verify your email before logging in. Check your inbox for the verification link.');
    }
    
    return user;
  }
}
