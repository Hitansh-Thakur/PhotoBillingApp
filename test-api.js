const { api } = require('./backend/src/utils/api');
const { getToken } = require('./backend/src/utils/storage');

async function testProductsAPI() {
    try {
        console.log('Testing /api/products endpoint...');

        // Check if we have a token
        const token = await getToken();
        console.log('Token:', token ? 'EXISTS' : 'MISSING');

        if (!token) {
            console.log('⚠️  No authentication token found. Please log in first.');
            console.log('   The app should automatically fetch products after login.');
            return;
        }

        // Try to fetch products
        const products = await api.get('/api/products');
        console.log('✓ Successfully fetched products:', products.length);
        console.log('Products:', JSON.stringify(products, null, 2));
    } catch (error) {
        console.error('✗ API Error:', error.message);
        console.error('Status:', error.status);
    }
}

testProductsAPI();
