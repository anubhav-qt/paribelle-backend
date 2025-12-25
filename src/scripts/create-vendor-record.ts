import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';

async function createVendorRecord() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const vendorId = '2286bb1e-a208-43b3-bdf4-59649f8d8491';

  try {
    // Check if vendor exists
    const existing = await dataSource.query(
      'SELECT * FROM vendors WHERE id = $1',
      [vendorId]
    );

    if (existing.length > 0) {
      console.log('✅ Vendor already exists:');
      console.log(JSON.stringify(existing[0], null, 2));
      await app.close();
      return;
    }

    console.log('⚠️  Vendor record not found, creating...');

    // Create vendor record
    const result = await dataSource.query(
      `INSERT INTO vendors (id, "storeName", status, description, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [vendorId, 'Fashion Street Store', 'active', 'Premium fashion and accessories']
    );

    console.log('✅ Vendor record created successfully!');
    console.log('═══════════════════════════════════');
    console.log(JSON.stringify(result[0], null, 2));
    console.log('═══════════════════════════════════');
  } catch (error) {
    console.error('❌ Error:', error);
  }

  await app.close();
}

createVendorRecord();
