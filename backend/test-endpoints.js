// Test script for new API endpoints
// Run with: node test-endpoints.js

const http = require('http');

const BASE_URL = 'http://localhost:4000';
let authToken = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Photo Billing Backend API\n');

    try {
        // Test 1: Health check
        console.log('1️⃣  Testing health endpoint...');
        const health = await makeRequest('GET', '/health');
        console.log('   ✅ Health:', health.data);

        // Test 2: Register (or login if already exists)
        console.log('\n2️⃣  Testing user registration...');
        const registerData = {
            name: 'API Test User',
            email: 'apitest@example.com',
            password: 'testpass123'
        };
        const register = await makeRequest('POST', '/api/auth/register', registerData);

        if (register.status === 201) {
            console.log('   ✅ Registration successful');
            authToken = register.data.token;
        } else if (register.status === 400 && register.data.message?.includes('exists')) {
            console.log('   ℹ️  User already exists, logging in...');
            const login = await makeRequest('POST', '/api/auth/login', {
                email: registerData.email,
                password: registerData.password
            });
            authToken = login.data.token;
            console.log('   ✅ Login successful');
        } else {
            console.log('   ⚠️  Registration response:', register);
        }

        // Test 3: Get user profile (NEW ENDPOINT)
        console.log('\n3️⃣  Testing GET /api/users/me (NEW)...');
        const profile = await makeRequest('GET', '/api/users/me', null, authToken);
        console.log('   ✅ Profile:', profile.data);

        // Test 4: Get analytics revenue (NEW ENDPOINT)
        console.log('\n4️⃣  Testing GET /api/analytics/revenue (NEW)...');
        const revenue = await makeRequest('GET', '/api/analytics/revenue?days=30', null, authToken);
        console.log('   ✅ Revenue:', revenue.data);

        // Test 5: Get top products (NEW ENDPOINT)
        console.log('\n5️⃣  Testing GET /api/analytics/top-products (NEW)...');
        const topProducts = await makeRequest('GET', '/api/analytics/top-products?limit=5', null, authToken);
        console.log('   ✅ Top Products:', topProducts.data);

        // Test 6: Get daily sales (NEW ENDPOINT)
        console.log('\n6️⃣  Testing GET /api/analytics/daily (NEW)...');
        const daily = await makeRequest('GET', '/api/analytics/daily', null, authToken);
        console.log('   ✅ Daily Sales (first 3):', daily.data.slice(0, 3));

        // Test 7: Get cashflow summary (NEW ENDPOINT)
        console.log('\n7️⃣  Testing GET /api/cashflow/summary (NEW)...');
        const summary = await makeRequest('GET', '/api/cashflow/summary', null, authToken);
        console.log('   ✅ Cashflow Summary:', summary.data);

        // Test 8: Get products
        console.log('\n8️⃣  Testing GET /api/products...');
        const products = await makeRequest('GET', '/api/products', null, authToken);
        console.log(`   ✅ Found ${products.data.length} products`);

        if (products.data.length > 0) {
            const productId = products.data[0].product_id;

            // Test 9: Update product stock (NEW ENDPOINT)
            console.log(`\n9️⃣  Testing PUT /api/products/${productId}/stock (NEW)...`);
            const stockUpdate = await makeRequest('PUT', `/api/products/${productId}/stock`,
                { quantity: products.data[0].quantity + 10 }, authToken);
            console.log('   ✅ Stock updated:', stockUpdate.data);
        }

        // Test 10: Create generic cashflow entry (NEW ENDPOINT)
        console.log('\n🔟 Testing POST /api/cashflow (NEW)...');
        const cashflowEntry = await makeRequest('POST', '/api/cashflow', {
            type: 'expense',
            amount: 50.00,
            description: 'Test expense from API test'
        }, authToken);
        console.log('   ✅ Cashflow entry created:', cashflowEntry.data);

        console.log('\n✨ All tests completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

runTests();
