import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/user.entity';
import * as bcrypt from 'bcrypt';

async function seedAdmin() {
  let app;
  
  try {
    console.log('👤 Creating admin user...');
    
    // Set a timeout
    const timeout = setTimeout(() => {
      console.error('❌ Timeout: Admin creation took too long');
      process.exit(1);
    }, 30000); // 30 second timeout
    
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });
    
    const usersService = app.get(UsersService);

    const adminEmail = process.env.ADMIN_EMAIL || 'anubhav.s.joshi@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Check if admin already exists
    const existingAdmin = await usersService.findByEmail(adminEmail);
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('Email:', adminEmail);
      clearTimeout(timeout);
      await app.close();
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await usersService.create({
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.SUPER_ADMIN,
      status: 'active' as any,
      emailVerifiedAt: new Date(), // Pre-verify admin user
    });

    console.log('✅ Admin user created successfully!');
    console.log('═══════════════════════════════════');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('═══════════════════════════════════');
    console.log('⚠️  IMPORTANT: Please change the password after first login!');
    
    clearTimeout(timeout);
    
    await app.close();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    
    if (app) {
      try {
        await app.close();
      } catch (e) {
        console.error('Error closing app:', e.message);
      }
    }
    
    process.exit(1);
  }
}

seedAdmin();
