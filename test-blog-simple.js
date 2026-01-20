const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQG1hcmtldHBsYWNlLmNvbSIsInN1YiI6IjAwOWJiMTg5LTViY2UtNDliYi1iZGU5LTJlZGY2MDBmYzhkMiIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImlhdCI6MTc2ODkyODAyMiwiZXhwIjoxNzY5NTMyODIyfQ.qaMJp7Y9Q0EjPJI8GdQ6ivx58-qCo3pfZZ4zj1bHxYA';

async function createBlogPost() {
  console.log('Creating test blog post...\n');
  
  const timestamp = Date.now();
  const blogData = {
    title: `Test Blog ${timestamp}`,
    slug: `test-blog-${timestamp}`,
    content: '<p>Test content from automated script</p>',
    excerpt: 'Test excerpt',
    pageType: 'blog',
    status: 'published',
    tags: ['test', 'automated'],
    authorName: 'Super Admin'
  };

  console.log('Sending:', JSON.stringify(blogData, null, 2));

  try {
    const response = await axios.post(`${API_URL}/marketplace/pages`, blogData, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('\n[SUCCESS] Blog post created!');
    console.log('ID:', response.data.id);
    console.log('Title:', response.data.title);
    console.log('Slug:', response.data.slug);
    console.log('Tags:', response.data.tags);
    console.log('View Count:', response.data.viewCount);
    console.log('\nURL: http://localhost:3000/blog/' + response.data.slug);
    
  } catch (err) {
    console.error('\n[ERROR] Failed to create blog');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Message:', err.message);
    }
    process.exit(1);
  }
}

createBlogPost();
