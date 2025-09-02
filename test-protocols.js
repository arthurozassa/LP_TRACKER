// Test script to verify our protocol configurations work
const { 
  protocolRegistry,
  getProtocolsByChain,
  getActiveProtocols,
  getDisplayName,
  validateWalletAddress,
  DEMO_WALLETS 
} = require('./src/utils/protocols/index.ts');

console.log('🔍 Testing Protocol Configuration System...\n');

// Test 1: Protocol Registry
console.log('📋 Protocol Registry:');
console.log(`Total protocols: ${Object.keys(protocolRegistry).length}`);
console.log('Available protocols:', Object.keys(protocolRegistry).join(', '));

// Test 2: Chain-specific protocols
console.log('\n⛓️  Protocols by Chain:');
console.log('Ethereum:', getProtocolsByChain('ethereum').map(p => `${p.emoji} ${p.name}`).join(', '));
console.log('Solana:', getProtocolsByChain('solana').map(p => `${p.emoji} ${p.name}`).join(', '));
console.log('Arbitrum:', getProtocolsByChain('arbitrum').map(p => `${p.emoji} ${p.name}`).join(', '));

// Test 3: Address validation
console.log('\n🔐 Address Validation:');
const ethAddress = DEMO_WALLETS.ethereum.address;
const solAddress = DEMO_WALLETS.solana.address;
console.log(`ETH address ${ethAddress}: ${JSON.stringify(validateWalletAddress(ethAddress))}`);
console.log(`SOL address ${solAddress}: ${JSON.stringify(validateWalletAddress(solAddress))}`);

// Test 4: Display names
console.log('\n🎨 Display Names:');
console.log('Uniswap V3:', getDisplayName('uniswap-v3'));
console.log('Meteora DLMM:', getDisplayName('meteora-dlmm'));
console.log('Orca Whirlpools:', getDisplayName('orca-whirlpools'));

console.log('\n✅ All tests completed!');