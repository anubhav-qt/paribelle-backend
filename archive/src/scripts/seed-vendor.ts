import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../modules/users/users.service';
import { UserRole } from '../modules/users/user.entity';
import * as bcrypt from 'bcrypt';

async function seedVendor() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const vendorEmail = process.env.VENDOR_EMAIL || 'fashionstreet@marketplace.com';
  const vendorPassword = process.env.VENDOR_PASSWORD || 'Fashion@123';
  const vendorId = process.env.VENDOR_ID || '6b70bb00-4f1e-4908-8cdf-9b5ae5bb07e7';

  try {
    // Check if vendor user already exists
    const existingVendor = await usersService.findByEmail(vendorEmail);
    
    if (existingVendor) {
      console.log('⚠️  Vendor user already exists - updating password...');
      
      // Update the password
      const hashedPassword = await bcrypt.hash(vendorPassword, 10);
      await usersService.update(existingVendor.id, {
        password: hashedPassword,
      });

      console.log('✅ Vendor password updated successfully!');
      console.log('═══════════════════════════════════');
      console.log('Email:', vendorEmail);
      console.log('Password:', vendorPassword);
      console.log('VendorId:', existingVendor.vendorId || vendorId);
      console.log('═══════════════════════════════════');
      await app.close();
      return;
    }

    // Create vendor user
    const hashedPassword = await bcrypt.hash(vendorPassword, 10);
    
    const vendor = await usersService.create({
      email: vendorEmail,
      password: hashedPassword,
      firstName: 'Fashion',
      lastName: 'Street',
      role: UserRole.VENDOR_ADMIN,
      status: 'active' as any,
      vendorId: vendorId,
    });

    console.log('✅ Vendor user created successfully!');
    console.log('═══════════════════════════════════');
    console.log('Email:', vendorEmail);
    console.log('Password:', vendorPassword);
    console.log('VendorId:', vendorId);
    console.log('═══════════════════════════════════');
  } catch (error) {
    console.error('❌ Error creating/updating vendor user:', error);
  }

  await app.close();
}

seedVendor();
