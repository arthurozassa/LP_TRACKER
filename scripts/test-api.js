#!/usr/bin/env node

/**
 * Simple test script for LP Tracker API endpoints
 * Run with: node scripts/test-api.js
 */

const BASE_URL = 'http://localhost:3000/api';

async function testEndpoint(method, endpoint, body = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Response:`, JSON.stringify(data, null, 2).slice(0, 500) + '...');
    
    return { success: response.ok, data };
  } catch (error) {
    console.error(`❌ Error testing ${method} ${endpoint}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting LP Tracker API Tests\n');
  
  const tests = [
    // Health check
    { method: 'GET', endpoint: '/health', description: 'Health check' },
    
    // Protocol endpoints
    { method: 'GET', endpoint: '/protocols', description: 'List all protocols' },
    { method: 'GET', endpoint: '/protocols?chain=ethereum&includeMetrics=true', description: 'List Ethereum protocols with metrics' },
    { method: 'GET', endpoint: '/protocols/ethereum', description: 'Get Ethereum protocols' },
    { method: 'GET', endpoint: '/protocols/solana', description: 'Get Solana protocols' },
    
    // Analytics endpoints
    { method: 'GET', endpoint: '/analytics?timeframe=30d', description: 'Get basic analytics' },
    { method: 'POST', endpoint: '/analytics', body: { timeframe: '7d', includeComparisons: true }, description: 'Get analytics with comparisons' },
    
    // Position endpoint (with mock ID)
    { method: 'GET', endpoint: '/positions/uniswap-v3-0x1234-0?includeHistorical=true', description: 'Get position details with history' },
    
    // Scan endpoints (with mock wallet)
    { method: 'POST', endpoint: '/scan/0x1234567890abcdef1234567890abcdef12345678', body: { chains: ['ethereum'] }, description: 'Start wallet scan' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.method, test.endpoint, test.body);
    results.push({
      ...test,
      success: result.success,
      error: result.error,
    });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('\n📋 Test Summary:');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.method} ${result.endpoint} - ${result.description}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\n🏆 Results: ${successful}/${total} tests passed`);
  
  if (successful === total) {
    console.log('🎉 All tests passed! API is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ This script requires Node.js 18+ with fetch support.');
  console.log('💡 Install node-fetch or upgrade Node.js:');
  console.log('   npm install node-fetch');
  console.log('   or upgrade to Node.js 18+');
  process.exit(1);
}

runTests().catch(console.error);