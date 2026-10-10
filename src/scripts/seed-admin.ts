import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/user.entity';
import { Vendor } from '../modules/store/vendor.entity';
import { STORE_ID } from '../modules/store/store.constants';

/**
 * A fresh database's first admin, and the store row orders are sold under.
 * Safe to re-run: each is created only when missing.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... npm run seed:admin
 *
 * Without ADMIN_PASSWORD a random one is generated and printed once.
 */
async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const usersService = app.get(UsersService);
    const stores = app.get(DataSource).getRepository(Vendor);

    const adminEmail = process.env.ADMIN_EMAIL || 'anubhav.s.joshi@gmail.com';
    let admin = await usersService.findByEmail(adminEmail);

    if (admin) {
      console.log(`Admin ${adminEmail} already exists`);
    } else {
      const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
      admin = await usersService.create({
        email: adminEmail,
        password: await bcrypt.hash(password, 10),
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.SUPER_ADMIN,
        status: 'active' as any,
        emailVerifiedAt: new Date(),
      });
      console.log(`Admin ${adminEmail} created`);
      if (!process.env.ADMIN_PASSWORD) {
        console.log(`Generated password (shown once): ${password}`);
      }
    }

    if (await stores.findOne({ where: { id: STORE_ID } })) {
      console.log('Store row already exists');
    } else {
      await stores.insert({ id: STORE_ID, storeName: 'PariBelle', slug: 'paribelle', userId: admin!.id });
      console.log('Store row created: fill in its business details under Admin > Settings > Business details');
    }
  } finally {
    await app.close();
  }
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
