import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/user.entity';
import * as bcrypt from 'bcrypt';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@marketplace.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

  try {
    // Check if admin already exists
    const existingAdmin = await usersService.findByEmail(adminEmail);
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('Email:', adminEmail);
      await app.close();
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const admin = await usersService.create({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.SUPER_ADMIN,
      status: 'active' as any,
    });

    console.log('✅ Admin user created successfully!');
    console.log('═══════════════════════════════════');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('═══════════════════════════════════');
    console.log('⚠️  IMPORTANT: Please change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }

  await app.close();
}

seedAdmin();
