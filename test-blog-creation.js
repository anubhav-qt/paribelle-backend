const axios = require('axios');
const { AppDataSource } = require('./dist/database/data-source');

const API_URL = 'http://localhost:3001/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQG1hcmtldHBsYWNlLmNvbSIsInN1YiI6IjAwOWJiMTg5LTViY2UtNDliYi1iZGU5LTJlZGY2MDBmYzhkMiIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImlhdCI6MTc2ODkyODAyMiwiZXhwIjoxNzY5NTMyODIyfQ.qaMJp7Y9Q0EjPJI8GdQ6ivx58-qCo3pfZZ4zj1bHxYA';

async function addBlogEnumValue() {
  console.log('\n[1] Adding "blog" to page_type enum...');
  try {
    process.env.NODE_ENV = 'production';
    await AppDataSource.initialize();
    await AppDataSource.query(
      "ALTER TYPE marketplace_pages_page_type_enum ADD VALUE IF NOT EXISTS 'blog'"
    );
    console.log('[OK] Blog enum value added/verified');
    await AppDataSource.destroy();
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('[OK] Blog enum value already exists');
      await AppDataSource.destroy();
    } else {
      console.error('[ERROR]', err.message);
      throw err;
    }
  }
}

async function createBlogPost() {
  console.log('\n[2] Creating test blog post...');
  
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const blogData = {
    title: `Test Blog ${timestamp}`,
    slug: `test-blog-${timestamp}`,
    content: '<p>Test content</p>',
    excerpt: 'Test excerpt',
    pageType: 'blog',
    status: 'published',
    tags: ['test'],
    authorName: 'Super Admin'
  };

  console.log('[INFO] Sending data:', JSON.stringify(blogData, null, 2));

  try {
    const response = await axios.post(`${API_URL}/marketplace/pages`, blogData, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[OK] Blog post created successfully!\n');
    console.log('Blog Details:');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Title: ${response.data.title}`);
    console.log(`   Slug: ${response.data.slug}`);
    console.log(`   Status: ${response.data.status}`);
    console.log(`   Tags: ${response.data.tags ? response.data.tags.join(', ') : 'none'}`);
    console.log(`   Author: ${response.data.authorName}`);
    console.log(`   View Count: ${response.data.viewCount}`);
    console.log(`\nView at: http://localhost:3000/blog/${response.data.slug}`);
    
    return response.data;
  } catch (err) {
    console.error('[ERROR] Failed to create blog post');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error:', err.message);
    }
    throw err;
  }
}

async function main() {
  console.log('Testing Blog Creation...\n');
  console.log('===================================================');
  
  try {
    // Step 1: Add blog enum value
    await addBlogEnumValue();
    
    // Step 2: Create blog post
    await createBlogPost();
    
    console.log('\n===================================================');
    console.log('[OK] All tests completed successfully!');
  } catch (err) {
    console.log('\n===================================================');
    console.error('[ERROR] Test failed:', err.message);
    process.exit(1);
  }
}

main();
