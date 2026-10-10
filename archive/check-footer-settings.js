// Quick script to check footer settings in database
const { Client } = require('pg');

async function checkFooterSettings() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'marketplace',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('📊 Connected to database');

    const result = await client.query('SELECT * FROM footer_settings');
    
    if (result.rows.length === 0) {
      console.log('❌ No footer settings found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} footer setting(s)`);
      result.rows.forEach((row, idx) => {
        console.log(`\n📋 Footer Settings ${idx + 1}:`);
        console.log('ID:', row.id);
        console.log('About Text:', row.aboutText?.substring(0, 50) + '...');
        console.log('Social Links Count:', row.socialLinks?.length || 0);
        console.log('Custom Sections Count:', row.customSections?.length || 0);
        
        if (row.customSections && row.customSections.length > 0) {
          console.log('\n🔸 Custom Sections:');
          row.customSections.forEach((section, sIdx) => {
            console.log(`  ${sIdx + 1}. ${section.title} (enabled: ${section.enabled})`);
            console.log(`     Links: ${section.links?.length || 0}`);
            if (section.links && section.links.length > 0) {
              section.links.forEach((link, lIdx) => {
                console.log(`       - ${link.label} -> ${link.url}`);
              });
            }
          });
        }
        
        console.log('\nContact Info:', JSON.stringify(row.contactInfo, null, 2));
        console.log('Show Categories:', row.showCategories);
        console.log('Max Categories:', row.maxCategoriesDisplay);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkFooterSettings();
