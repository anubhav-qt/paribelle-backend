import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Email lookups ignore case and surrounding spaces. They were exact, so an
   * account made as "Anu@Gmail.com" (a phone keyboard capitalises the first
   * letter) couldn't sign in as "anu@gmail.com", and Google sign-in, which
   * reports the address in lowercase, made it a second account. Older rows
   * may differ only in case; the exact match wins if so.
   */
  private byEmail(email: string) {
    const exact = String(email ?? '').trim();
    return this.usersRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: exact })
      .orderBy('CASE WHEN user.email = :exact THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('user.createdAt', 'ASC')
      .setParameter('exact', exact);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.byEmail(email).getOne();
  }

  /**
   * Same as findByEmail, but pulls the password hash back in — it is
   * `select: false` on the entity, so ordinary finds omit it. Only the login
   * check should call this.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    // addSelect rather than select, so every other column still comes back —
    // the login response spreads this user straight through to the client.
    return this.byEmail(email).addSelect('user.password').getOne();
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, userData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
