const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🧪 Testing API endpoint: /api/v1/products/slug/customshirt\n');
    
    const response = await fetch('http://localhost:3001/api/v1/products/slug/customshirt');
    const data = await response.json();
    
    console.log('📦 Product Response:');
    console.log('   Name:', data.name);
    console.log('   Slug:', data.slug);
    console.log('   Is Parent:', data.isParent);
    console.log('   Variation Themes:', JSON.stringify(data.variationThemes));
    console.log('   Variations Count:', data.variations ? data.variations.length : 0);
    
    if (data.variations && data.variations.length > 0) {
      console.log('\n✅ Variations loaded successfully!');
      console.log('\nFirst 3 variations:');
      data.variations.slice(0, 3).forEach((v, i) => {
        console.log(`\n${i + 1}. ${v.name}`);
        console.log(`   SKU: ${v.sku}`);
        console.log(`   Price: $${v.price}`);
        console.log(`   Stock: ${v.stockQuantity}`);
        console.log(`   Attributes: ${JSON.stringify(v.variationAttributes)}`);
      });
    } else {
      console.log('\n❌ No variations found in API response!');
      console.log('\nFull response structure:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();
