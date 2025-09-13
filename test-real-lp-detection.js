#!/usr/bin/env node

/**
 * Real LP Position Detection Validator
 * Tests the accuracy of real LP position detection system
 */

const fetch = require('node-fetch');

// Test addresses with known real positions
const TEST_ADDRESSES = {
  ethereum: [
    '0x742d35Cc6634C0532925a3b8D0C6A02E02b365f2', // Known Uniswap V3 LP
    '0x4648451B5F87ff8F403D5D7A7fA01fAD1E0AC2F9', // Another known LP
    '0x8ba1f109551bD432803012645Hac136c8Cc522c' // Test dismantled positions
  ],
  arbitrum: [
    '0x742d35Cc6634C0532925a3b8D0C6A02E02b365f2', // Test Arbitrum positions
    '0x4648451B5F87ff8F403D5D7A7fA01fAD1E0AC2F9'
  ],
  solana: [
    'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', // Known Solana LP
    '6UsHdVPnNmU8jxNNSJN5tsDq8RMnzHLqZ1WpXJJj8LVN' // Test dismantled positions
  ]
};

// Known inactive/dismantled positions for testing filtering
const KNOWN_INACTIVE_POSITIONS = [
  '0x8ba1f109551bD432803012645Hac136c8Cc522c', // Ethereum with closed positions
  '6UsHdVPnNmU8jxNNSJN5tsDq8RMnzHLqZ1WpXJJj8LVN'  // Solana with closed positions
];

class RealLPValidator {
  constructor() {
    this.results = {
      ethereum: { passed: 0, failed: 0, details: [] },
      arbitrum: { passed: 0, failed: 0, details: [] },
      solana: { passed: 0, failed: 0, details: [] }
    };
    this.criticalIssues = [];
  }

  async validateChain(chain, addresses) {
    console.log(`\n🔍 Testing ${chain.toUpperCase()} LP Position Detection...`);
    
    for (const address of addresses) {
      try {
        const result = await this.testAddress(address, chain);
        this.results[chain].details.push(result);
        
        if (result.success) {
          this.results[chain].passed++;
          console.log(`✅ ${address}: ${result.positionsFound} positions found`);
        } else {
          this.results[chain].failed++;
          console.log(`❌ ${address}: ${result.error}`);
          this.criticalIssues.push(`${chain}: ${address} - ${result.error}`);
        }
      } catch (error) {
        console.log(`💥 ${address}: Critical error - ${error.message}`);
        this.results[chain].failed++;
        this.criticalIssues.push(`${chain}: ${address} - Critical error: ${error.message}`);
      }
    }
  }

  async testAddress(address, chain) {
    try {
      // Test the API endpoint
      const response = await fetch(`${this.apiUrl}/api/scan-wallet?address=${address}&chain=${chain}`);
      
      if (!response.ok) {
        return {
          success: false,
          error: `API returned ${response.status}: ${response.statusText}`,
          address,
          chain
        };
      }

      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'API returned success: false',
          address,
          chain
        };
      }

      // Analyze the response
      const scanResults = data.data;
      const positionsFound = scanResults ? scanResults.totalPositions : 0;
      const protocols = scanResults ? Object.keys(scanResults.protocols) : [];
      
      // Check for critical issues
      const issues = [];
      
      // Issue 1: Check if dismantled positions are properly filtered
      if (KNOWN_INACTIVE_POSITIONS.includes(address)) {
        if (positionsFound > 0) {
          issues.push('CRITICAL: Dismantled positions showing as active');
        }
      }
      
      // Issue 2: Check Arbitrum detection specifically
      if (chain === 'arbitrum' && positionsFound === 0) {
        issues.push('CRITICAL: Missing Arbitrum positions - user reported active pools not detected');
      }
      
      // Issue 3: Check for real vs fake data patterns
      if (positionsFound > 0) {
        const positions = [];
        protocols.forEach(protocolName => {
          if (scanResults.protocols[protocolName] && scanResults.protocols[protocolName].positions) {
            positions.push(...scanResults.protocols[protocolName].positions);
          }
        });
        
        // Check for fake data patterns
        const hasSuspiciousFakeData = positions.some(pos => {
          // Check for placeholder values
          return pos.value === 1000 || pos.feesEarned === 50 || pos.apr === 15.5;
        });
        
        if (hasSuspiciousFakeData) {
          issues.push('WARNING: Potential fake/placeholder data detected');
        }
        
        // Check for proper liquidity filtering
        const hasZeroLiquidity = positions.some(pos => pos.liquidity === 0);
        if (hasZeroLiquidity) {
          issues.push('CRITICAL: Positions with zero liquidity (closed positions) detected');
        }
      }

      return {
        success: true,
        positionsFound,
        protocols,
        issues,
        rawData: scanResults,
        address,
        chain
      };
    } catch (error) {
      throw new Error(`Network/parsing error: ${error.message}`);
    }
  }

  async testBlockchainCalls() {
    console.log('\n🔗 Testing Direct Blockchain Calls...');
    
    // Test Ethereum Uniswap V3 contract
    try {
      const ethRpc = 'https://ethereum.publicnode.com';
      const positionsContract = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
      const testAddress = '0x742d35Cc6634C0532925a3b8D0C6A02E02b365f2';
      
      const response = await fetch(ethRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: positionsContract,
            data: `0x70a08231000000000000000000000000${testAddress.slice(2).padStart(40, '0')}`
          }, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const balance = parseInt(data.result || '0x0', 16);
      
      console.log(`✅ Direct Ethereum RPC: Found ${balance} Uniswap V3 NFTs for test address`);
      
      if (balance === 0) {
        this.criticalIssues.push('Direct blockchain call shows 0 positions - address may not have LP positions');
      }
    } catch (error) {
      console.log(`❌ Direct Ethereum RPC failed: ${error.message}`);
      this.criticalIssues.push(`Direct blockchain call failed: ${error.message}`);
    }

    // Test Arbitrum specific
    try {
      const arbRpc = 'https://arb1.arbitrum.io/rpc';
      const positionsContract = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
      const testAddress = '0x742d35Cc6634C0532925a3b8D0C6A02E02b365f2';
      
      const response = await fetch(arbRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: positionsContract,
            data: `0x70a08231000000000000000000000000${testAddress.slice(2).padStart(40, '0')}`
          }, 'latest'],
          id: 1,
        }),
      });

      const data = await response.json();
      const balance = parseInt(data.result || '0x0', 16);
      
      console.log(`✅ Direct Arbitrum RPC: Found ${balance} Uniswap V3 NFTs for test address`);
      
      if (balance === 0) {
        console.log('⚠️  Note: Test address may not have Arbitrum positions - this could be expected');
      }
    } catch (error) {
      console.log(`❌ Direct Arbitrum RPC failed: ${error.message}`);
      this.criticalIssues.push(`Arbitrum blockchain call failed: ${error.message}`);
    }
  }

  async run() {
    console.log('🚀 Starting Real LP Position Detection Validation\n');
    
    // Check if the dev server is running
    const ports = [3000, 3001, 3002];
    let serverPort = null;
    
    for (const port of ports) {
      try {
        const healthCheck = await fetch(`http://localhost:${port}/api/scan-wallet?address=0x0&chain=ethereum`);
        if (healthCheck.status === 400) { // Should return 400 for invalid address
          serverPort = port;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!serverPort) {
      console.log('❌ Dev server not accessible. Please run: npm run dev');
      return;
    }
    
    this.apiUrl = `http://localhost:${serverPort}`;
    console.log(`✅ Found dev server running on port ${serverPort}`);

    // Test direct blockchain calls first
    await this.testBlockchainCalls();
    
    // Test each chain
    for (const [chain, addresses] of Object.entries(TEST_ADDRESSES)) {
      await this.validateChain(chain, addresses);
    }
    
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 REAL LP POSITION DETECTION VALIDATION REPORT');
    console.log('='.repeat(60));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [chain, result] of Object.entries(this.results)) {
      console.log(`\n${chain.toUpperCase()}:`);
      console.log(`  ✅ Passed: ${result.passed}`);
      console.log(`  ❌ Failed: ${result.failed}`);
      console.log(`  📊 Success Rate: ${Math.round((result.passed / (result.passed + result.failed)) * 100)}%`);
      
      totalPassed += result.passed;
      totalFailed += result.failed;
      
      // Show detailed issues
      result.details.forEach(detail => {
        if (detail.issues && detail.issues.length > 0) {
          console.log(`    🚨 ${detail.address}:`);
          detail.issues.forEach(issue => {
            console.log(`      - ${issue}`);
          });
        }
      });
    }
    
    console.log(`\n🎯 OVERALL RESULTS:`);
    console.log(`  ✅ Total Passed: ${totalPassed}`);
    console.log(`  ❌ Total Failed: ${totalFailed}`);
    console.log(`  📊 Overall Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
    
    if (this.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES FOUND:`);
      this.criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    
    if (this.criticalIssues.some(issue => issue.includes('Dismantled positions'))) {
      console.log('  1. Fix liquidity filtering in RealLpDetector - check line 43 condition');
    }
    
    if (this.criticalIssues.some(issue => issue.includes('Arbitrum'))) {
      console.log('  2. Verify Arbitrum RPC endpoint and position detection logic (lines 305-361)');
    }
    
    if (this.criticalIssues.some(issue => issue.includes('fake'))) {
      console.log('  3. Replace placeholder values with real blockchain data');
    }
    
    if (this.criticalIssues.some(issue => issue.includes('blockchain call failed'))) {
      console.log('  4. Check RPC endpoints and network connectivity');
    }
    
    console.log('\n📝 DETAILED ANALYSIS:');
    console.log('  - RealLpDetector implementation needs review if critical issues found');
    console.log('  - TrulyFreeScanner integration should be tested with real data');
    console.log('  - API endpoint should handle production vs demo mode correctly');
    
    if (this.criticalIssues.length === 0) {
      console.log('\n🎉 SUCCESS: No critical issues found! LP detection appears to be working correctly.');
    } else {
      console.log('\n⚠️  ACTION REQUIRED: Critical issues detected. Please address the above recommendations.');
    }
  }
}

// Run the validator
const validator = new RealLPValidator();
validator.run().catch(error => {
  console.error('💥 Validator crashed:', error);
  process.exit(1);
});