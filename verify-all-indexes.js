const { Client } = require('pg');
require('dotenv').config();

/**
 * Comprehensive Index Verification Script
 * Checks all indexes in the database and identifies missing or unused ones
 */

async function verifyAllIndexes() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('═══════════════════════════════════════════');
    console.log('📊 COMPREHENSIVE INDEX VERIFICATION REPORT');
    console.log('═══════════════════════════════════════════\n');

    // Get all indexes in the database
    const indexesResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log(`Found ${indexesResult.rows.length} indexes\n`);

    // Group by table
    const indexesByTable = {};
    indexesResult.rows.forEach(row => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row);
    });

    // Display indexes by table
    console.log('📋 INDEXES BY TABLE:');
    console.log('===================\n');

    for (const [tableName, indexes] of Object.entries(indexesByTable)) {
      console.log(`\n${tableName.toUpperCase()} (${indexes.length} indexes):`);
      console.log('─'.repeat(50));
      
      indexes.forEach(idx => {
        const isPrimary = idx.indexname.includes('_pkey');
        const isUnique = idx.indexdef.includes('UNIQUE');
        const prefix = isPrimary ? '🔑' : isUnique ? '⭐' : '📊';
        
        console.log(`${prefix} ${idx.indexname}`);
        if (!isPrimary) {
          // Extract column names from index definition
          const match = idx.indexdef.match(/\((.*?)\)/);
          if (match) {
            console.log(`   Columns: ${match[1]}`);
          }
        }
      });
    }

    console.log('\n\n🔍 EXPECTED INDEXES VERIFICATION:');
    console.log('=================================\n');

    // Define expected indexes for key tables
    const expectedIndexes = {
      users: ['idx_users_email', 'idx_users_role', 'idx_users_status'],
      vendors: ['idx_vendors_userId', 'idx_vendors_slug', 'idx_vendors_status', 'idx_vendors_cityId', 'idx_vendors_subLocationId'],
      categories: ['idx_categories_slug', 'idx_categories_parentId', 'idx_categories_isActive', 'idx_categories_vendorId_isActive', 'idx_categories_isActive_sortOrder'],
      products: ['idx_products_vendorId', 'idx_products_slug', 'idx_products_status', 'idx_products_createdAt', 'idx_products_vendorId_status', 'idx_products_status_createdAt', 'idx_products_vendorId_createdAt'],
      product_variants: ['idx_product_variants_productId', 'idx_product_variants_sku'],
      orders: ['idx_orders_userId', 'idx_orders_vendorId', 'idx_orders_orderNumber', 'idx_orders_status', 'idx_orders_paymentStatus', 'idx_orders_createdAt'],
      order_items: ['idx_order_items_orderId', 'idx_order_items_productId'],
      payments: ['idx_payments_orderId', 'idx_payments_userId', 'idx_payments_status', 'idx_payments_gatewayPaymentId'],
      returns: ['idx_returns_order_id', 'idx_returns_order_item_id', 'idx_returns_user_id', 'idx_returns_vendor_id', 'idx_returns_status', 'idx_returns_return_number', 'idx_returns_requested_at'],
      return_refunds: ['idx_return_refunds_return_id', 'idx_return_refunds_status'],
      addresses: ['idx_addresses_userId', 'idx_addresses_isDefault'],
      product_reviews: ['idx_product_reviews_productId', 'idx_product_reviews_userId'],
      vendor_reviews: ['idx_vendor_reviews_vendorId', 'idx_vendor_reviews_userId'],
      cities: ['idx_cities_slug', 'idx_cities_isActive'],
      sub_locations: ['idx_sub_locations_cityId'],
      vendor_pages: ['idx_vendor_pages_vendorId_slug', 'idx_vendor_pages_vendorId', 'idx_vendor_pages_status']
    };

    let missingIndexes = [];
    let foundIndexes = 0;

    for (const [table, expectedIdxs] of Object.entries(expectedIndexes)) {
      console.log(`\n${table}:`);
      
      for (const idx of expectedIdxs) {
        const exists = indexesByTable[table]?.some(i => i.indexname === idx);
        if (exists) {
          console.log(`  ✅ ${idx}`);
          foundIndexes++;
        } else {
          console.log(`  ❌ ${idx} - MISSING!`);
          missingIndexes.push({ table, index: idx });
        }
      }
    }

    // Index usage statistics
    console.log('\n\n📈 INDEX USAGE STATISTICS:');
    console.log('=========================\n');

    const usageResult = await client.query(`
      SELECT
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY idx_scan ASC
      LIMIT 20;
    `);

    if (usageResult.rows.length > 0) {
      console.log('Least Used Indexes (potential candidates for removal):');
      console.log('─'.repeat(80));
      console.log(String('Index Name').padEnd(40) + String('Scans').padEnd(10) + String('Size').padEnd(10) + 'Table');
      console.log('─'.repeat(80));
      
      usageResult.rows.forEach(row => {
        if (!row.indexname.includes('_pkey')) {
          console.log(
            String(row.indexname).padEnd(40) +
            String(row.scans).padEnd(10) +
            String(row.size).padEnd(10) +
            row.tablename
          );
        }
      });
    } else {
      console.log('⚠️  No usage statistics available yet (database may be new)');
    }

    // Check for missing indexes on foreign keys
    console.log('\n\n🔗 FOREIGN KEY INDEX CHECK:');
    console.log('==========================\n');

    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);

    for (const fk of fkResult.rows) {
      const hasIndex = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = $1
            AND indexdef LIKE '%' || $2 || '%'
        );
      `, [fk.table_name, fk.column_name]);

      const indexed = hasIndex.rows[0].exists;
      const status = indexed ? '✅' : '⚠️';
      console.log(`${status} ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}`);
    }

    // Summary
    console.log('\n\n═══════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════\n');
    
    console.log(`Total indexes found: ${indexesResult.rows.length}`);
    console.log(`Expected indexes verified: ${foundIndexes}/${foundIndexes + missingIndexes.length}`);
    
    if (missingIndexes.length > 0) {
      console.log(`\n⚠️  MISSING INDEXES: ${missingIndexes.length}`);
      console.log('\nTo add missing indexes, run:');
      missingIndexes.forEach(({ table, index }) => {
        console.log(`  -- Add ${index} for ${table} table`);
      });
    } else {
      console.log('\n✅ All expected indexes are present!');
    }

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('   • Review least-used indexes periodically');
    console.log('   • All foreign keys should have indexes for JOIN performance');
    console.log('   • Consider composite indexes for frequently queried column combinations');
    console.log('   • Monitor query performance and add indexes as needed');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

verifyAllIndexes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
