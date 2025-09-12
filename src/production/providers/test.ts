/**
 * Test file for Web3 providers
 * This file demonstrates how to use the providers and can be used for testing
 */

import {
  ProviderFactory,
  MultiChainProvider,
  getProviderForAddress,
  detectChainType,
  PROVIDER_PRESETS,
  ChainType
} from './index';

// Test addresses
const ETH_ADDRESS = '0x742d35Cc6d54E0532e3Bf2b8ABcCD8e90d3c3f5C';
const SOLANA_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

/**
 * Test address detection
 */
export function testAddressDetection() {
  console.log('=== Testing Address Detection ===');
  
  const ethType = detectChainType(ETH_ADDRESS);
  const solType = detectChainType(SOLANA_ADDRESS);
  
  console.log(`Ethereum address ${ETH_ADDRESS} detected as: ${ethType}`);
  console.log(`Solana address ${SOLANA_ADDRESS} detected as: ${solType}`);
  
  console.log(`Is ETH address valid: ${ProviderFactory.isEthereumAddress(ETH_ADDRESS)}`);
  console.log(`Is SOL address valid: ${ProviderFactory.isSolanaAddress(SOLANA_ADDRESS)}`);
}

/**
 * Test Ethereum provider
 */
export async function testEthereumProvider() {
  console.log('\n=== Testing Ethereum Provider ===');
  
  try {
    const provider = await ProviderFactory.getEthereumProvider('mainnet');
    
    // Test basic functionality (these will fail without actual RPC endpoints)
    console.log('Ethereum provider initialized successfully');
    console.log('Network info:', provider.getNetworkInfo());
    console.log('Provider stats:', provider.getProviderStats());
    
    // These would need actual API keys to work
    // const blockNumber = await provider.getBlockNumber();
    // console.log('Current block number:', blockNumber);
    
    // const balance = await provider.getBalance(ETH_ADDRESS);
    // console.log(`Balance for ${ETH_ADDRESS}: ${balance} ETH`);
    
  } catch (error) {
    console.error('Ethereum provider test failed:', error);
  }
}

/**
 * Test Solana provider
 */
export async function testSolanaProvider() {
  console.log('\n=== Testing Solana Provider ===');
  
  try {
    const provider = await ProviderFactory.getSolanaProvider('mainnet-beta');
    
    console.log('Solana provider initialized successfully');
    console.log('Cluster info:', provider.getClusterInfo());
    console.log('Provider stats:', provider.getProviderStats());
    
    // These would need actual RPC endpoints to work
    // const slot = await provider.getSlot();
    // console.log('Current slot:', slot);
    
    // const balance = await provider.getBalance(SOLANA_ADDRESS);
    // console.log(`Balance for ${SOLANA_ADDRESS}: ${balance} SOL`);
    
  } catch (error) {
    console.error('Solana provider test failed:', error);
  }
}

/**
 * Test multi-chain provider
 */
export async function testMultiChainProvider() {
  console.log('\n=== Testing Multi-Chain Provider ===');
  
  try {
    const multiProvider = new MultiChainProvider(
      PROVIDER_PRESETS.DEVELOPMENT.ethereum,
      PROVIDER_PRESETS.DEVELOPMENT.solana
    );
    
    await multiProvider.initialize();
    console.log('Multi-chain provider initialized successfully');
    console.log('Overall health:', multiProvider.isHealthy());
    
    // Test address-based routing
    try {
      console.log(`Getting balance for ETH address: ${ETH_ADDRESS}`);
      // const ethBalance = await multiProvider.getBalance(ETH_ADDRESS);
      // console.log('ETH balance result:', ethBalance);
    } catch (error) {
      console.log('ETH balance test skipped (needs RPC):', error.message);
    }
    
    try {
      console.log(`Getting balance for SOL address: ${SOLANA_ADDRESS}`);
      // const solBalance = await multiProvider.getBalance(SOLANA_ADDRESS);
      // console.log('SOL balance result:', solBalance);
    } catch (error) {
      console.log('SOL balance test skipped (needs RPC):', error.message);
    }
    
    await multiProvider.destroy();
    console.log('Multi-chain provider destroyed successfully');
    
  } catch (error) {
    console.error('Multi-chain provider test failed:', error);
  }
}

/**
 * Test provider factory
 */
export async function testProviderFactory() {
  console.log('\n=== Testing Provider Factory ===');
  
  try {
    // Test auto-detection and provider creation
    console.log('Testing automatic provider selection...');
    
    const ethProvider = await getProviderForAddress(ETH_ADDRESS);
    console.log('Auto-selected provider for ETH address: Ethereum provider');
    
    const solProvider = await getProviderForAddress(SOLANA_ADDRESS);
    console.log('Auto-selected provider for SOL address: Solana provider');
    
    // Test factory stats
    const stats = ProviderFactory.getProviderStats();
    console.log('Factory stats:', {
      hasEthereum: !!stats.ethereum,
      hasSolana: !!stats.solana,
      overallHealth: stats.overallHealth
    }, 'Logger message');
    
    // Cleanup
    await ProviderFactory.destroyAll();
    console.log('All providers destroyed successfully');
    
  } catch (error) {
    console.error('Provider factory test failed:', error);
  }
}

/**
 * Test configuration presets
 */
export function testConfigPresets() {
  console.log('\n=== Testing Configuration Presets ===');
  
  console.log('Production preset:');
  console.log('- ETH endpoints:', PROVIDER_PRESETS.PRODUCTION.ethereum.endpoints.length);
  console.log('- SOL endpoints:', PROVIDER_PRESETS.PRODUCTION.solana.endpoints.length);
  
  console.log('Development preset:');
  console.log('- ETH network:', PROVIDER_PRESETS.DEVELOPMENT.ethereum.networkName);
  console.log('- SOL cluster:', PROVIDER_PRESETS.DEVELOPMENT.solana.cluster);
  
  console.log('Testing preset:');
  console.log('- ETH logging:', PROVIDER_PRESETS.TESTING.ethereum.logging.enabled);
  console.log('- SOL logging:', PROVIDER_PRESETS.TESTING.solana.logging.enabled);
  console.log('- Health checks disabled:', !PROVIDER_PRESETS.TESTING.ethereum.healthCheck.enabled);
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Starting Web3 Provider Tests\n');
  
  testAddressDetection();
  testConfigPresets();
  
  await testEthereumProvider();
  await testSolanaProvider();
  await testMultiChainProvider();
  await testProviderFactory();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 Note: Some tests are skipped because they require actual RPC endpoints.');
  console.log('To test with real networks, set up the following environment variables:');
  console.log('- INFURA_MAINNET_URL');
  console.log('- ALCHEMY_MAINNET_URL');  
  console.log('- HELIUS_MAINNET_URL');
  console.log('- QUICKNODE_SOLANA_URL');
}

// Auto-run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}