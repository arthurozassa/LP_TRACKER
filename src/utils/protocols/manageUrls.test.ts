import {
  generateManageUrl,
  getProtocolManageButtonText,
  supportsDirectManagement,
  validateUrlParams,
  extractUrlParamsFromPosition,
  generateManageUrlWithFallback,
  PROTOCOL_MANAGE_CONFIGS,
} from './manageUrls';

describe('Protocol Management URLs', () => {
  // Test URL generation for different protocols
  describe('generateManageUrl', () => {
    test('generates correct Uniswap V3 URLs with position ID', () => {
      const params = {
        protocol: 'uniswap-v3',
        positionId: '12345',
        chain: 'ethereum' as any,
      };
      
      const url = generateManageUrl(params);
      expect(url).toBe('https://app.uniswap.org#/pool/12345');
    });

    test('generates correct SushiSwap URLs with pool address', () => {
      const params = {
        protocol: 'sushiswap',
        poolAddress: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
        chain: 'ethereum' as any,
      };
      
      const url = generateManageUrl(params);
      expect(url).toBe('https://app.sushi.com/pools/0x397FF1542f962076d0BFE58eA045FfA2d347ACa0');
    });

    test('generates correct Meteora DLMM URLs for Solana', () => {
      const params = {
        protocol: 'meteora-dlmm',
        poolAddress: 'BbZjQanvSaE9me4adAitmTTaSgASuAxFaEBTWN9gGtAa',
        chain: 'solana' as any,
      };
      
      const url = generateManageUrl(params);
      expect(url).toBe('https://app.meteora.ag/dlmm/BbZjQanvSaE9me4adAitmTTaSgASuAxFaEBTWN9gGtAa');
    });

    test('applies chain-specific modifications for L2s', () => {
      const params = {
        protocol: 'uniswap-v3-arbitrum',
        positionId: '67890',
        chain: 'arbitrum' as any,
      };
      
      const url = generateManageUrl(params);
      expect(url).toBe('https://app.uniswap.org#/pool/67890?chain=arbitrum');
    });

    test('returns # for unsupported protocols', () => {
      const params = {
        protocol: 'unknown-protocol',
        poolAddress: '0x123',
        chain: 'ethereum' as any,
      };
      
      const url = generateManageUrl(params);
      expect(url).toBe('#');
    });
  });

  // Test protocol button text generation
  describe('getProtocolManageButtonText', () => {
    test('returns correct display names for protocols', () => {
      expect(getProtocolManageButtonText('uniswap-v3')).toBe('Uniswap V3');
      expect(getProtocolManageButtonText('sushiswap')).toBe('SushiSwap');
      expect(getProtocolManageButtonText('meteora-dlmm')).toBe('Meteora');
      expect(getProtocolManageButtonText('raydium-clmm')).toBe('Raydium');
      expect(getProtocolManageButtonText('orca-whirlpools')).toBe('Orca');
    });

    test('handles unknown protocols gracefully', () => {
      expect(getProtocolManageButtonText('unknown-protocol')).toBe('Unknown-protocol');
    });
  });

  // Test protocol support detection
  describe('supportsDirectManagement', () => {
    test('returns true for supported protocols', () => {
      expect(supportsDirectManagement('uniswap-v3')).toBe(true);
      expect(supportsDirectManagement('sushiswap')).toBe(true);
      expect(supportsDirectManagement('meteora-dlmm')).toBe(true);
    });

    test('returns false for unsupported protocols', () => {
      expect(supportsDirectManagement('unknown-protocol')).toBe(false);
    });
  });

  // Test parameter validation
  describe('validateUrlParams', () => {
    test('validates required position ID for Uniswap V3', () => {
      const params = {
        protocol: 'uniswap-v3',
        chain: 'ethereum' as any,
      };
      
      const result = validateUrlParams(params);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('position ID');
    });

    test('passes validation with all required parameters', () => {
      const params = {
        protocol: 'uniswap-v3',
        positionId: '12345',
        chain: 'ethereum' as any,
      };
      
      const result = validateUrlParams(params);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  // Test position data extraction
  describe('extractUrlParamsFromPosition', () => {
    test('extracts URL parameters from position object', () => {
      const position = {
        id: 'pos-123',
        protocol: 'uniswap-v3',
        chain: 'ethereum',
        poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
        tokens: {
          token0: { address: '0xA0b86a33E6441cB81308d4d1F4cD4F6BE0b5B2F8' },
          token1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
        },
        feeTier: 500,
      };
      
      const params = extractUrlParamsFromPosition(position);
      expect(params.protocol).toBe('uniswap-v3');
      expect(params.positionId).toBe('pos-123');
      expect(params.chain).toBe('ethereum');
      expect(params.poolAddress).toBe('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640');
      expect(params.tokenA).toBe('0xA0b86a33E6441cB81308d4d1F4cD4F6BE0b5B2F8');
      expect(params.tokenB).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
      expect(params.feeTier).toBe(500);
    });
  });

  // Test fallback URL generation
  describe('generateManageUrlWithFallback', () => {
    test('returns specific URL when possible', () => {
      const params = {
        protocol: 'uniswap-v3',
        positionId: '12345',
        chain: 'ethereum' as any,
      };
      
      const url = generateManageUrlWithFallback(params);
      expect(url).toBe('https://app.uniswap.org#/pool/12345');
    });

    test('returns fallback URL when specific generation fails', () => {
      const params = {
        protocol: 'uniswap-v3',
        chain: 'ethereum' as any,
        // Missing required positionId
      };
      
      const url = generateManageUrlWithFallback(params);
      expect(url).toBe('https://app.uniswap.org/#/pools');
    });
  });
});

// Example usage test data
export const mockPositions = {
  uniswapV3: {
    id: 'uni-pos-123',
    protocol: 'uniswap-v3',
    chain: 'ethereum',
    pool: 'USDC/WETH 0.05%',
    poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
    value: 15000,
    feesEarned: 125.50,
    apr: 12.5,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'USDC',
        amount: 7500,
        address: '0xA0b86a33E6441cB81308d4d1F4cD4F6BE0b5B2F8',
      },
      token1: {
        symbol: 'WETH',
        amount: 3.2,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
    },
    feeTier: 500,
  },
  sushiswap: {
    id: 'sushi-pos-456',
    protocol: 'sushiswap',
    chain: 'ethereum',
    pool: 'USDC/WETH',
    poolAddress: '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0',
    value: 8500,
    feesEarned: 67.25,
    apr: 18.7,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'USDC',
        amount: 4250,
        address: '0xA0b86a33E6441cB81308d4d1F4cD4F6BE0b5B2F8',
      },
      token1: {
        symbol: 'WETH',
        amount: 1.8,
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      },
    },
  },
  meteoraDlmm: {
    id: 'meteora-pos-789',
    protocol: 'meteora-dlmm',
    chain: 'solana',
    pool: 'SOL/USDC',
    poolAddress: 'BbZjQanvSaE9me4adAitmTTaSgASuAxFaEBTWN9gGtAa',
    value: 12000,
    feesEarned: 89.75,
    apr: 24.3,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'SOL',
        amount: 35.5,
        address: 'So11111111111111111111111111111111111111112',
      },
      token1: {
        symbol: 'USDC',
        amount: 6000,
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
    },
  },
};