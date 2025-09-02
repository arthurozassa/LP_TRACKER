/**
 * Test utilities and examples for chain detection
 * This file can be used for testing and as documentation
 */

import {
  validateAddress,
  detectChainFromAddress,
  autoDetectScanningNetwork,
  getSupportedProtocols,
  getChainInfo,
  isValidAddress,
  getChainType,
  getPrimaryNetwork,
  getScanNetworks,
  getAddressInfo,
  DEMO_ADDRESSES,
  type AddressValidationResult,
  type NetworkDetectionResult,
} from './index';

// Test addresses for validation
export const TEST_ADDRESSES = {
  // Valid Ethereum addresses
  VALID_ETHEREUM: [
    '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik's address
    '0x000000000000000000000000000000000000dead', // Burn address
    '0xA0b86a33E6441D9b1dCE72e3bD0c2b52E20F8F3F',
  ],
  // Valid Solana addresses
  VALID_SOLANA: [
    'J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w',
    '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    'So11111111111111111111111111111111111111112', // Wrapped SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  ],
  // Invalid addresses
  INVALID: [
    '0x123', // Too short
    'invalid', // Not hex
    '0xInvalidHexString1234567890123456789012345678', // Invalid hex
    'Not-A-Valid-Address-At-All',
    '', // Empty
    '   ', // Whitespace
    '0x', // Just prefix
    '123456789012345678901234567890123456789012345', // Wrong length
  ],
} as const;

/**
 * Runs comprehensive tests on the chain detection utilities
 */
export function runChainDetectionTests(): {
  passed: number;
  failed: number;
  results: Array<{ test: string; passed: boolean; error?: string }>;
} {
  const results: Array<{ test: string; passed: boolean; error?: string }> = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Ethereum address validation
  try {
    const ethereumTests = TEST_ADDRESSES.VALID_ETHEREUM.every(addr => 
      isValidAddress(addr) && getChainType(addr) === 'ethereum'
    );
    if (ethereumTests) {
      results.push({ test: 'Ethereum address validation', passed: true });
      passed++;
    } else {
      results.push({ test: 'Ethereum address validation', passed: false });
      failed++;
    }
  } catch (error) {
    results.push({ 
      test: 'Ethereum address validation', 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    failed++;
  }

  // Test 2: Solana address validation
  try {
    const solanaTests = TEST_ADDRESSES.VALID_SOLANA.every(addr => 
      isValidAddress(addr) && getChainType(addr) === 'solana'
    );
    if (solanaTests) {
      results.push({ test: 'Solana address validation', passed: true });
      passed++;
    } else {
      results.push({ test: 'Solana address validation', passed: false });
      failed++;
    }
  } catch (error) {
    results.push({ 
      test: 'Solana address validation', 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    failed++;
  }

  // Test 3: Invalid address rejection
  try {
    const invalidTests = TEST_ADDRESSES.INVALID.every(addr => 
      !isValidAddress(addr)
    );
    if (invalidTests) {
      results.push({ test: 'Invalid address rejection', passed: true });
      passed++;
    } else {
      results.push({ test: 'Invalid address rejection', passed: false });
      failed++;
    }
  } catch (error) {
    results.push({ 
      test: 'Invalid address rejection', 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    failed++;
  }

  // Test 4: Demo addresses work
  try {
    const demoAddresses = Object.values(DEMO_ADDRESSES);
    const demoTests = demoAddresses.every(addr => isValidAddress(addr));
    if (demoTests) {
      results.push({ test: 'Demo addresses validation', passed: true });
      passed++;
    } else {
      results.push({ test: 'Demo addresses validation', passed: false });
      failed++;
    }
  } catch (error) {
    results.push({ 
      test: 'Demo addresses validation', 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    failed++;
  }

  // Test 5: Network scanning detection
  try {
    const ethScanNetworks = getScanNetworks(TEST_ADDRESSES.VALID_ETHEREUM[0]);
    const solScanNetworks = getScanNetworks(TEST_ADDRESSES.VALID_SOLANA[0]);
    
    const networkTests = ethScanNetworks.length > 0 && solScanNetworks.length > 0;
    if (networkTests) {
      results.push({ test: 'Network scanning detection', passed: true });
      passed++;
    } else {
      results.push({ test: 'Network scanning detection', passed: false });
      failed++;
    }
  } catch (error) {
    results.push({ 
      test: 'Network scanning detection', 
      passed: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    failed++;
  }

  return { passed, failed, results };
}

/**
 * Example usage demonstrations
 */
export function demonstrateUsage(): void {
  console.log('=== Chain Detection Utility Demo ===\n');

  // Demo 1: Basic validation
  console.log('1. Basic Address Validation:');
  const testAddr = DEMO_ADDRESSES.ETHEREUM_LP;
  console.log(`Address: ${testAddr}`);
  console.log(`Is Valid: ${isValidAddress(testAddr)}`);
  console.log(`Chain Type: ${getChainType(testAddr)}`);
  console.log(`Primary Network: ${getPrimaryNetwork(testAddr)}\n`);

  // Demo 2: Detailed validation
  console.log('2. Detailed Validation:');
  const validation = validateAddress(testAddr);
  console.log('Validation Result:', validation);
  console.log();

  // Demo 3: Network detection
  console.log('3. Network Detection:');
  try {
    const detection = autoDetectScanningNetwork(testAddr);
    console.log('Detection Result:', detection);
  } catch (error) {
    console.log('Detection Error:', error);
  }
  console.log();

  // Demo 4: Protocol support
  console.log('4. Protocol Support:');
  const networks = getScanNetworks(testAddr);
  networks.forEach(network => {
    try {
      const protocols = getSupportedProtocols(network);
      console.log(`${network}: ${protocols.join(', ')}`);
    } catch (error) {
      console.log(`${network}: Error loading protocols`);
    }
  });
  console.log();

  // Demo 5: Address info
  console.log('5. Address Info:');
  const addressInfo = getAddressInfo(testAddr);
  console.log('Address Info:', addressInfo);
  console.log();

  // Demo 6: Batch validation
  console.log('6. Batch Validation:');
  const addresses = [
    DEMO_ADDRESSES.ETHEREUM_LP,
    DEMO_ADDRESSES.SOLANA_WHALE,
    'invalid-address',
  ];
  
  addresses.forEach(addr => {
    const info = getAddressInfo(addr);
    console.log(`${addr} -> ${info.isValid ? info.displayName : 'Invalid'}`);
  });
}

/**
 * Performance test for validation functions
 */
export function performanceTest(iterations: number = 1000): {
  validationTime: number;
  detectionTime: number;
  iterationsPerSecond: number;
} {
  const testAddresses = [
    ...TEST_ADDRESSES.VALID_ETHEREUM,
    ...TEST_ADDRESSES.VALID_SOLANA,
  ];

  // Test validation performance
  const validationStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const addr = testAddresses[i % testAddresses.length];
    validateAddress(addr);
  }
  const validationEnd = performance.now();
  const validationTime = validationEnd - validationStart;

  // Test detection performance
  const detectionStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const addr = testAddresses[i % testAddresses.length];
    detectChainFromAddress(addr);
  }
  const detectionEnd = performance.now();
  const detectionTime = detectionEnd - detectionStart;

  return {
    validationTime,
    detectionTime,
    iterationsPerSecond: iterations / ((validationTime + detectionTime) / 2000),
  };
}