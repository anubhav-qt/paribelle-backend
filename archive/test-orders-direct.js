const fetch = require('node-fetch');

// Use the actual token we just got from login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQG1hcmtldHBsYWNlLmNvbSIsInN1YiI6IjAwOWJiMTg5LTViY2UtNDliYi1iZGU5LTJlZGY2MDBmYzhkMiIsInJvbGUiOiJzdXBlcl9hZG1pbiIsImlhdCI6MTc2ODg5NTAyOCwiZXhwIjoxNzY5NDk5ODI4fQ.e2dGAE-fojFYDWAAjn-TR7SWoW0KGIOeHSIZtQxtISc';

async function testOrders() {
  try {
    console.log('Testing /api/v1/orders endpoint...\n');
    
    const response = await fetch('http://localhost:3001/api/v1/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    if (!response.ok) {
      const error = await response.text();
      console.log('Error response:', error);
      return;
    }
    
    const orders = await response.json();
    console.log(`\nFound ${orders.length} orders:`);
    console.log(JSON.stringify(orders, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOrders();
