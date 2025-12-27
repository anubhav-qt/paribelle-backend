/**
 * Footer Page Templates
 * 
 * This script provides predefined page templates that can be easily added
 * to footer sections through the admin panel.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Predefined footer page templates
const footerPageTemplates = {
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', url: '/privacy-policy' },
      { label: 'Terms of Service', url: '/terms-of-service' },
      { label: 'Cookie Policy', url: '/cookie-policy' }
    ],
    enabled: true
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About Us', url: '/about-us' },
      { label: 'Become a Vendor', url: '/become-a-vendor' },
      { label: 'Contact Us', url: '/contact' }
    ],
    enabled: true
  },
  support: {
    title: 'Support',
    links: [
      { label: 'Help Center', url: '/help' },
      { label: 'FAQ', url: '/faq' },
      { label: 'Shipping Info', url: '/shipping' },
      { label: 'Returns', url: '/returns' }
    ],
    enabled: true
  },
  shop: {
    title: 'Shop',
    links: [
      { label: 'All Products', url: '/products' },
      { label: 'New Arrivals', url: '/products?sort=newest' },
      { label: 'Best Sellers', url: '/products?sort=popular' },
      { label: 'Sale', url: '/products?on_sale=true' }
    ],
    enabled: true
  }
};

async function addFooterTemplates() {
  console.log('📋 Adding footer page templates...\n');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  });

  try {
    // Check if footer settings exist
    const checkQuery = 'SELECT id, "customSections" FROM footer_settings LIMIT 1';
    const result = await pool.query(checkQuery);

    if (result.rows.length === 0) {
      console.log('⚠️  No footer settings found. Creating default footer settings with templates...\n');

      // Create default footer settings with all templates
      const insertQuery = `
        INSERT INTO footer_settings (
          id, "aboutText", "socialLinks", "customSections", "contactInfo",
          "copyrightText", "showCategories", "maxCategoriesDisplay",
          "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(),
          'Your marketplace description goes here. We connect buyers and sellers in a trusted, secure platform.',
          '[]'::jsonb,
          $1::jsonb,
          $2::jsonb,
          '© 2025 Your Marketplace. All rights reserved.',
          true,
          6,
          NOW(),
          NOW()
        )
        RETURNING id;
      `;

      const customSections = [
        footerPageTemplates.legal,
        footerPageTemplates.company,
        footerPageTemplates.support,
        footerPageTemplates.shop
      ];

      const contactInfo = {
        phone: '+1 (555) 123-4567',
        email: 'support@yourmarketplace.com',
        address: '123 Marketplace St, City, State 12345'
      };

      await pool.query(insertQuery, [
        JSON.stringify(customSections),
        JSON.stringify(contactInfo)
      ]);

      console.log('✅ Created footer settings with page templates!');
      console.log('\n📋 Added sections:');
      Object.keys(footerPageTemplates).forEach(key => {
        const template = footerPageTemplates[key];
        console.log(`   • ${template.title} (${template.links.length} links)`);
      });
    } else {
      console.log('ℹ️  Footer settings already exist.');
      console.log('   Would you like to:');
      console.log('   1. Replace existing custom sections (use --replace flag)');
      console.log('   2. Merge with existing sections (use --merge flag)');
      console.log('\nCurrent custom sections:', result.rows[0].customSections.length);
      
      const shouldReplace = process.argv.includes('--replace');
      const shouldMerge = process.argv.includes('--merge');

      if (shouldReplace) {
        // Replace all custom sections
        const updateQuery = `
          UPDATE footer_settings
          SET "customSections" = $1::jsonb,
              "updatedAt" = NOW()
          WHERE id = $2
          RETURNING id;
        `;

        const customSections = [
          footerPageTemplates.legal,
          footerPageTemplates.company,
          footerPageTemplates.support,
          footerPageTemplates.shop
        ];

        await pool.query(updateQuery, [
          JSON.stringify(customSections),
          result.rows[0].id
        ]);

        console.log('\n✅ Replaced custom sections with templates!');
      } else if (shouldMerge) {
        // Merge with existing sections
        const existingSections = result.rows[0].customSections || [];
        const newSections = [
          footerPageTemplates.legal,
          footerPageTemplates.company,
          footerPageTemplates.support,
          footerPageTemplates.shop
        ];

        // Only add sections that don't already exist (based on title)
        const existingTitles = new Set(existingSections.map(s => s.title));
        const sectionsToAdd = newSections.filter(s => !existingTitles.has(s.title));

        if (sectionsToAdd.length > 0) {
          const mergedSections = [...existingSections, ...sectionsToAdd];

          const updateQuery = `
            UPDATE footer_settings
            SET "customSections" = $1::jsonb,
                "updatedAt" = NOW()
            WHERE id = $2
            RETURNING id;
          `;

          await pool.query(updateQuery, [
            JSON.stringify(mergedSections),
            result.rows[0].id
          ]);

          console.log(`\n✅ Added ${sectionsToAdd.length} new sections!`);
          sectionsToAdd.forEach(s => console.log(`   • ${s.title}`));
        } else {
          console.log('\n✅ All template sections already exist!');
        }
      } else {
        console.log('\n💡 Run with --replace or --merge flag to update footer settings.');
      }
    }

    console.log('\n📄 Template sections available:');
    console.log('   • Legal: Privacy Policy, Terms of Service, Cookie Policy');
    console.log('   • Company: About Us, Become a Vendor, Contact Us');
    console.log('   • Support: Help Center, FAQ, Shipping Info, Returns');
    console.log('   • Shop: All Products, New Arrivals, Best Sellers, Sale');

    console.log('\n🎨 Customize these in your admin panel at:');
    console.log('   http://localhost:3000/admin/settings/footer');

  } catch (error) {
    console.error('❌ Error adding footer templates:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
addFooterTemplates();
