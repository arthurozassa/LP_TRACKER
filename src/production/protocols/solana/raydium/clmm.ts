/**
 * Raydium Concentrated Liquidity Market Maker (CLMM) Integration
 * Handles CLMM pool scanning and position parsing
 */

import {
  SolanaAccountInfo,
  SolanaContext,
  RaydiumPosition,
  RaydiumPool,
  SolanaIntegrationError,
  SolanaParsingError,
  SOLANA_PROGRAMS,
  isValidSolanaAddress
} from '../common/types';
import {
  parseU64,
  parseU128,
  parseI64,
  tokenAmountToUi,
  tickToSqrtPrice,
  sqrtPriceToTick,
  retryWithBackoff,
  handleRpcError
} from '../common/utils';
import {
  fetchAccountInfo,
  fetchProgramAccounts,
  verifyAccountOwner,
  verifyAccountDiscriminator,
  filterAccountsByDiscriminator
} from '../common/accounts';
import { ProtocolType, ChainType } from '../../../../types';

// ============================================================================
// RAYDIUM CONSTANTS
// ============================================================================

export const RAYDIUM_CLMM_PROGRAM_ID = SOLANA_PROGRAMS.RAYDIUM_CLMM;

// Account discriminators (first 8 bytes of account data)
export const RAYDIUM_DISCRIMINATORS = {
  POOL_STATE: Buffer.from([0xf4, 0x84, 0x73, 0xa9, 0x6b, 0x1d, 0x5a, 0x8c]), // PoolState
  POSITION_NFT: Buffer.from([0xaa, 0xbc, 0x8f, 0xe4, 0x79, 0x0c, 0x4b, 0x6c]), // PersonalPositionState
  AMM_CONFIG: Buffer.from([0x9a, 0x57, 0xf2, 0xe1, 0x47, 0x35, 0x2f, 0x8d]), // AmmConfig
  OBSERVATION_STATE: Buffer.from([0x8c, 0x1d, 0x5f, 0xa9, 0x6b, 0x73, 0x4e, 0x2a]), // ObservationState
  TICK_ARRAY: Buffer.from([0x3b, 0x8c, 0x2f, 0x68, 0x91, 0x4d, 0x6a, 0xe5]), // TickArrayState
};

// Data structure sizes
export const RAYDIUM_SIZES = {
  POOL_STATE: 1544,
  POSITION_NFT: 312,
  AMM_CONFIG: 168,
  OBSERVATION_STATE: 3208,
  TICK_ARRAY: 8 + (88 * 60), // Header + ticks
  TICK: 88,
};

// ============================================================================
// RAYDIUM ACCOUNT PARSERS
// ============================================================================

/**
 * Parse Raydium PoolState account data
 */
export function parsePoolStateAccount(data: Buffer): RaydiumPool {
  try {
    if (data.length < RAYDIUM_SIZES.POOL_STATE) {
      throw new Error(`Invalid PoolState data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse basic pool info
    const ammConfig = data.slice(offset, offset + 32);
    offset += 32;

    const owner = data.slice(offset, offset + 32);
    offset += 32;

    const tokenMint0 = data.slice(offset, offset + 32);
    offset += 32;

    const tokenMint1 = data.slice(offset, offset + 32);
    offset += 32;

    const tokenVault0 = data.slice(offset, offset + 32);
    offset += 32;

    const tokenVault1 = data.slice(offset, offset + 32);
    offset += 32;

    const observationKey = data.slice(offset, offset + 32);
    offset += 32;

    // Parse pool state
    const mintDecimals0 = data.readUInt8(offset);
    offset += 1;

    const mintDecimals1 = data.readUInt8(offset);
    offset += 1;

    const tickSpacing = data.readUInt16LE(offset);
    offset += 2;

    const liquidity = parseU128(data, offset);
    offset += 16;

    const sqrtPriceX64 = parseU128(data, offset);
    offset += 16;

    const tickCurrent = data.readInt32LE(offset);
    offset += 4;

    const observationIndex = data.readUInt16LE(offset);
    offset += 2;

    const observationUpdateDuration = data.readUInt16LE(offset);
    offset += 2;

    const feeGrowthGlobal0X64 = parseU128(data, offset);
    offset += 16;

    const feeGrowthGlobal1X64 = parseU128(data, offset);
    offset += 16;

    const protocolFeesToken0 = parseU64(data, offset);
    offset += 8;

    const protocolFeesToken1 = parseU64(data, offset);
    offset += 8;

    const swapInAmountToken0 = parseU128(data, offset);
    offset += 16;

    const swapOutAmountToken1 = parseU128(data, offset);
    offset += 16;

    const swapInAmountToken1 = parseU128(data, offset);
    offset += 16;

    const swapOutAmountToken0 = parseU128(data, offset);
    offset += 16;

    // Parse tick array bitmap (512 bytes)
    const tickArrayBitmap = [];
    for (let i = 0; i < 16; i++) {
      const bitmapChunk = parseU64(data, offset);
      tickArrayBitmap.push(bitmapChunk);
      offset += 8;
    }

    // Parse fund fees
    const fundFeesToken0 = parseU64(data, offset);
    offset += 8;

    const fundFeesToken1 = parseU64(data, offset);
    offset += 8;

    const openTime = parseU64(data, offset);
    offset += 8;

    // Calculate current price from sqrtPriceX64
    const sqrtPrice = Number(sqrtPriceX64) / Math.pow(2, 64);
    const currentPrice = sqrtPrice * sqrtPrice;

    const tokenA = {
      address: tokenMint0.toString('hex'),
      vault: tokenVault0.toString('hex'),
      decimals: mintDecimals0,
      symbol: 'UNKNOWN',
      reserve: swapInAmountToken0 // Approximation
    };

    const tokenB = {
      address: tokenMint1.toString('hex'),
      vault: tokenVault1.toString('hex'),
      decimals: mintDecimals1,
      symbol: 'UNKNOWN',
      reserve: swapInAmountToken1 // Approximation
    };

    return {
      address: '', // Filled by caller
      programId: RAYDIUM_CLMM_PROGRAM_ID,
      tokenA,
      tokenB,
      tickSpacing,
      tickCurrent,
      sqrtPrice: sqrtPriceX64,
      liquidity,
      feeRate: 0, // Would get from AMM config
      
      // CLMM specific
      ammConfig: ammConfig.toString('hex'),
      observationKey: observationKey.toString('hex'),
      tickArrayBitmap: tickArrayBitmap.map(chunk => chunk.toString()),
      protocolFeesTokenA: protocolFeesToken0,
      protocolFeesTokenB: protocolFeesToken1,
      fundFeesTokenA: fundFeesToken0,
      fundFeesTokenB: fundFeesToken1,
      openTime,
      
      // Statistics (would be calculated or fetched from API)
      volume24h: 0,
      fees24h: 0,
      tvl: 0,
      apr: 0,
      
      // Metadata
      lastSlot: 0,
      createdAt: Date.now()
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Raydium PoolState account',
      'raydium-clmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse Raydium PersonalPositionState (Position NFT) account data
 */
export function parsePersonalPositionAccount(data: Buffer): RaydiumPosition {
  try {
    if (data.length < RAYDIUM_SIZES.POSITION_NFT) {
      throw new Error(`Invalid position data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse position owner and pool
    const nftOwner = data.slice(offset, offset + 32);
    offset += 32;

    const poolId = data.slice(offset, offset + 32);
    offset += 32;

    const positionNftMint = data.slice(offset, offset + 32);
    offset += 32;

    // Parse tick range
    const tickLowerIndex = data.readInt32LE(offset);
    offset += 4;

    const tickUpperIndex = data.readInt32LE(offset);
    offset += 4;

    // Parse liquidity
    const liquidity = parseU128(data, offset);
    offset += 16;

    // Parse fee growth inside last
    const feeGrowthInside0LastX64 = parseU128(data, offset);
    offset += 16;

    const feeGrowthInside1LastX64 = parseU128(data, offset);
    offset += 16;

    // Parse tokens owed
    const tokenFeesOwed0 = parseU64(data, offset);
    offset += 8;

    const tokenFeesOwed1 = parseU64(data, offset);
    offset += 8;

    // Parse reward info (3 reward slots)
    const rewardInfos = [];
    for (let i = 0; i < 3; i++) {
      const rewardGrowthInsideLastX64 = parseU128(data, offset);
      offset += 16;

      const rewardAmountOwed = parseU64(data, offset);
      offset += 8;

      rewardInfos.push({
        rewardMint: '', // Would get from pool config
        rewardVault: '',
        rewardGrowthGlobalX64: '0',
        rewardAmountOwed
      });
    }

    // Calculate prices from ticks
    const priceLower = Math.pow(1.0001, tickLowerIndex);
    const priceUpper = Math.pow(1.0001, tickUpperIndex);

    // Calculate token amounts (simplified - real calculation is complex)
    const liquidityNum = Number(liquidity);
    const priceRange = priceUpper - priceLower;
    const midPrice = (priceLower + priceUpper) / 2;
    
    // Rough approximation of token amounts
    const amountA = liquidityNum / Math.sqrt(midPrice);
    const amountB = liquidityNum * Math.sqrt(midPrice);

    const currentTime = Date.now();

    return {
      id: `raydium-${poolId.toString('hex')}-${nftOwner.toString('hex')}`,
      protocol: 'raydium-clmm',
      chain: 'solana' as any,
      pool: poolId.toString('hex'),
      
      // Position amounts
      liquidity: Number(liquidity),
      value: 0, // Calculated later with prices
      feesEarned: Number(tokenFeesOwed0) + Number(tokenFeesOwed1),
      apr: 0, // Calculated later
      inRange: true, // Would check against current tick
      
      // Tokens
      tokens: {
        token0: {
          address: '', // Would get from pool info
          symbol: 'UNKNOWN',
          amount: Math.floor(amountA),
          decimals: 9
        },
        token1: {
          address: '', // Would get from pool info
          symbol: 'UNKNOWN',
          amount: Math.floor(amountB),
          decimals: 9
        }
      },

      // Solana-specific
      accounts: {
        position: '', // Filled by caller
        mint0: '', // Would get from pool
        mint1: '', // Would get from pool
      },
      
      programId: RAYDIUM_CLMM_PROGRAM_ID,
      liquidity: liquidity,
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      feeGrowthInside0LastX64,
      feeGrowthInside1LastX64,
      tokensOwed0: tokenFeesOwed0,
      tokensOwed1: tokenFeesOwed1,
      rewards: [], // Would be populated from pool reward config
      
      // CLMM specific
      poolId: poolId.toString('hex'),
      positionNftMint: positionNftMint.toString('hex'),
      positionNftAccount: '', // Would be derived
      priceLower,
      priceUpper,
      amountA: amountA.toString(),
      amountB: amountB.toString(),
      feeOwedA: tokenFeesOwed0,
      feeOwedB: tokenFeesOwed1,
      feeGrowthInsideLastA: feeGrowthInside0LastX64,
      feeGrowthInsideLastB: feeGrowthInside1LastX64,
      rewardInfos,
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime,
      updatedAt: currentTime
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Raydium position account',
      'raydium-clmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse AMM Config account (contains fee tier info)
 */
export function parseAmmConfigAccount(data: Buffer): {
  index: number;
  owner: string;
  protocolFeeRate: number;
  tradeFeeRate: number;
  tickSpacing: number;
  fundFeeRate: number;
} {
  try {
    if (data.length < RAYDIUM_SIZES.AMM_CONFIG) {
      throw new Error(`Invalid AmmConfig data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    const bump = data.readUInt8(offset);
    offset += 1;

    const index = data.readUInt16LE(offset);
    offset += 2;

    const owner = data.slice(offset, offset + 32);
    offset += 32;

    const protocolFeeRate = data.readUInt32LE(offset);
    offset += 4;

    const tradeFeeRate = data.readUInt32LE(offset);
    offset += 4;

    const tickSpacing = data.readUInt16LE(offset);
    offset += 2;

    const fundFeeRate = data.readUInt32LE(offset);
    offset += 4;

    const fundOwner = data.slice(offset, offset + 32);
    offset += 32;

    return {
      index,
      owner: owner.toString('hex'),
      protocolFeeRate,
      tradeFeeRate,
      tickSpacing,
      fundFeeRate
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Raydium AmmConfig account',
      'raydium-clmm',
      data,
      error as Error
    );
  }
}

// ============================================================================
// RAYDIUM SCANNING
// ============================================================================

/**
 * Scan for Raydium CLMM pools
 */
export async function scanRaydiumPools(
  context: SolanaContext
): Promise<RaydiumPool[]> {
  try {
    const pools: RaydiumPool[] = [];
    
    // Fetch all PoolState accounts
    const filters = [{
      dataSize: RAYDIUM_SIZES.POOL_STATE
    }];
    
    const accounts = await fetchProgramAccounts(
      context,
      RAYDIUM_CLMM_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const poolAccounts = filterAccountsByDiscriminator(
      accounts,
      RAYDIUM_DISCRIMINATORS.POOL_STATE
    );
    
    for (const { pubkey, account } of poolAccounts) {
      try {
        const pool = parsePoolStateAccount(account.data as Buffer);
        pool.address = pubkey;
        pools.push(pool);
      } catch (error) {
        console.warn(`Failed to parse Raydium pool ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${pools.length} Raydium CLMM pools`);
    return pools;
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to scan Raydium pools',
      'raydium-clmm',
      'SCAN_FAILED',
      error as Error
    );
  }
}

/**
 * Scan for Raydium positions owned by a wallet
 */
export async function scanRaydiumPositions(
  context: SolanaContext,
  walletAddress: string
): Promise<RaydiumPosition[]> {
  try {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new SolanaIntegrationError(
        `Invalid wallet address: ${walletAddress}`,
        'raydium-clmm',
        'INVALID_ADDRESS'
      );
    }

    const positions: RaydiumPosition[] = [];
    
    // Scan for position NFT accounts owned by the wallet
    const filters = [
      {
        dataSize: RAYDIUM_SIZES.POSITION_NFT
      },
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: walletAddress
        }
      }
    ];
    
    const accounts = await fetchProgramAccounts(
      context,
      RAYDIUM_CLMM_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const positionAccounts = filterAccountsByDiscriminator(
      accounts,
      RAYDIUM_DISCRIMINATORS.POSITION_NFT
    );
    
    for (const { pubkey, account } of positionAccounts) {
      try {
        const position = parsePersonalPositionAccount(account.data as Buffer);
        position.accounts.position = pubkey;
        
        // Filter out empty positions
        if (Number(position.liquidity) > 0) {
          positions.push(position);
        }
      } catch (error) {
        console.warn(`Failed to parse Raydium position ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${positions.length} Raydium positions for wallet ${walletAddress}`);
    return positions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to scan Raydium positions for wallet ${walletAddress}`,
      'raydium-clmm',
      'SCAN_FAILED',
      error as Error
    );
  }
}

// ============================================================================
// RAYDIUM POSITION ENRICHMENT
// ============================================================================

/**
 * Enrich position with pool data and current prices
 */
export async function enrichRaydiumPosition(
  context: SolanaContext,
  position: RaydiumPosition,
  priceFeeds?: Map<string, number>
): Promise<RaydiumPosition> {
  try {
    // Fetch pool data
    const poolAccount = await fetchAccountInfo(context, position.pool);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${position.pool}`);
    }
    
    const pool = parsePoolStateAccount(poolAccount.data as Buffer);
    
    // Update position with pool info
    position.tokens.token0.address = pool.tokenA.address;
    position.tokens.token1.address = pool.tokenB.address;
    position.tokens.token0.decimals = pool.tokenA.decimals;
    position.tokens.token1.decimals = pool.tokenB.decimals;
    position.accounts.mint0 = pool.tokenA.address;
    position.accounts.mint1 = pool.tokenB.address;
    
    // Check if position is in range
    position.inRange = pool.tickCurrent >= position.tickLower && 
                      pool.tickCurrent <= position.tickUpper;
    
    // Calculate position value if prices are available
    if (priceFeeds) {
      const token0Price = priceFeeds.get(pool.tokenA.address) || 0;
      const token1Price = priceFeeds.get(pool.tokenB.address) || 0;
      
      const token0ValueUi = tokenAmountToUi(
        position.tokens.token0.amount.toString(),
        position.tokens.token0.decimals
      );
      const token1ValueUi = tokenAmountToUi(
        position.tokens.token1.amount.toString(),
        position.tokens.token1.decimals
      );
      
      position.value = (token0ValueUi * token0Price) + (token1ValueUi * token1Price);
      
      // Calculate APR (simplified)
      if (position.value > 0 && position.feesEarned > 0) {
        const dailyFees = position.feesEarned; // Assuming this is daily
        position.apr = (dailyFees / position.value) * 365 * 100;
      }
    }
    
    // Fetch AMM config for fee information
    try {
      const ammConfigAccount = await fetchAccountInfo(context, pool.ammConfig);
      if (ammConfigAccount) {
        const ammConfig = parseAmmConfigAccount(ammConfigAccount.data as Buffer);
        // Update fee information if needed
      }
    } catch (error) {
      console.warn('Failed to fetch AMM config:', error);
    }
    
    return position;
  } catch (error) {
    console.warn(`Failed to enrich Raydium position ${position.id}:`, error);
    return position;
  }
}

/**
 * Calculate position token amounts from liquidity and tick range
 */
export function calculatePositionAmounts(
  liquidity: string,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number
): { amount0: string; amount1: string } {
  try {
    const liquidityNum = Number(liquidity);
    
    if (liquidityNum === 0) {
      return { amount0: '0', amount1: '0' };
    }
    
    const sqrtPriceLower = Math.sqrt(Math.pow(1.0001, tickLower));
    const sqrtPriceUpper = Math.sqrt(Math.pow(1.0001, tickUpper));
    const sqrtPriceCurrent = Math.sqrt(Math.pow(1.0001, tickCurrent));
    
    let amount0 = 0;
    let amount1 = 0;
    
    if (tickCurrent < tickLower) {
      // Only token0
      amount0 = liquidityNum * (sqrtPriceUpper - sqrtPriceLower) / (sqrtPriceUpper * sqrtPriceLower);
    } else if (tickCurrent >= tickUpper) {
      // Only token1
      amount1 = liquidityNum * (sqrtPriceUpper - sqrtPriceLower);
    } else {
      // Both tokens
      amount0 = liquidityNum * (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceUpper * sqrtPriceCurrent);
      amount1 = liquidityNum * (sqrtPriceCurrent - sqrtPriceLower);
    }
    
    return {
      amount0: Math.floor(amount0).toString(),
      amount1: Math.floor(amount1).toString()
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate position amounts`,
      'raydium-clmm',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Get current pool state and price information
 */
export async function getRaydiumPoolState(
  context: SolanaContext,
  poolAddress: string
): Promise<{
  pool: RaydiumPool;
  currentPrice: number;
  tickCurrent: number;
  liquidity: string;
  sqrtPriceX64: string;
}> {
  try {
    const poolAccount = await fetchAccountInfo(context, poolAddress);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${poolAddress}`);
    }
    
    const pool = parsePoolStateAccount(poolAccount.data as Buffer);
    
    // Calculate current price from sqrtPriceX64
    const sqrtPrice = Number(pool.sqrtPrice) / Math.pow(2, 64);
    const currentPrice = sqrtPrice * sqrtPrice;
    
    return {
      pool,
      currentPrice,
      tickCurrent: pool.tickCurrent || 0,
      liquidity: pool.liquidity || '0',
      sqrtPriceX64: pool.sqrtPrice || '0'
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get Raydium pool state for ${poolAddress}`,
      'raydium-clmm',
      'POOL_STATE_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  RAYDIUM_CLMM_PROGRAM_ID,
  RAYDIUM_DISCRIMINATORS,
  RAYDIUM_SIZES,
  
  // Parsers
  parsePoolStateAccount,
  parsePersonalPositionAccount,
  parseAmmConfigAccount,
  
  // Scanners
  scanRaydiumPools,
  scanRaydiumPositions,
  
  // Enrichment
  enrichRaydiumPosition,
  calculatePositionAmounts,
  getRaydiumPoolState,
};