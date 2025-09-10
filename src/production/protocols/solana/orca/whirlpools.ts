/**
 * Orca Whirlpools Integration
 * Handles Orca concentrated liquidity positions and pool scanning
 */

import {
  SolanaAccountInfo,
  SolanaContext,
  OrcaPosition,
  OrcaPool,
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
// ORCA CONSTANTS
// ============================================================================

export const ORCA_WHIRLPOOL_PROGRAM_ID = SOLANA_PROGRAMS.ORCA_WHIRLPOOLS;

// Account discriminators (first 8 bytes of account data)
export const ORCA_DISCRIMINATORS = {
  WHIRLPOOL: Buffer.from([0x63, 0xd6, 0x9f, 0x1c, 0x8f, 0xa6, 0x8b, 0xd4]), // Whirlpool
  POSITION: Buffer.from([0xaa, 0xbc, 0x8f, 0xe4, 0x79, 0x0c, 0x4b, 0x6c]), // Position
  WHIRLPOOLS_CONFIG: Buffer.from([0x0a, 0x1b, 0x2c, 0x3d, 0x4e, 0x5f, 0x60, 0x71]), // WhirlpoolsConfig
  TICK_ARRAY: Buffer.from([0x0a, 0xff, 0xee, 0xdd, 0xcc, 0xbb, 0xaa, 0x99]), // TickArray
  FEE_TIER: Buffer.from([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81]), // FeeTier
};

// Data structure sizes
export const ORCA_SIZES = {
  WHIRLPOOL: 653,
  POSITION: 216,
  WHIRLPOOLS_CONFIG: 80,
  TICK_ARRAY: 8320,
  FEE_TIER: 80,
};

// ============================================================================
// ORCA ACCOUNT PARSERS
// ============================================================================

/**
 * Parse Orca Whirlpool account data
 */
export function parseWhirlpoolAccount(data: Buffer): OrcaPool {
  try {
    if (data.length < ORCA_SIZES.WHIRLPOOL) {
      throw new Error(`Invalid Whirlpool data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse whirlpools config
    const whirlpoolsConfig = data.slice(offset, offset + 32);
    offset += 32;

    // Parse whirlpool bump
    const whirlpoolBump = [];
    for (let i = 0; i < 1; i++) {
      whirlpoolBump.push(data.readUInt8(offset));
      offset += 1;
    }

    // Parse tick spacing
    const tickSpacing = data.readUInt16LE(offset);
    offset += 2;

    // Parse tick spacing seed (2 bytes)
    const tickSpacingSeed = data.slice(offset, offset + 2);
    offset += 2;

    // Parse fee rate (2 bytes)
    const feeRate = data.readUInt16LE(offset);
    offset += 2;

    // Parse protocol fee rate (2 bytes)
    const protocolFeeRate = data.readUInt16LE(offset);
    offset += 2;

    // Parse liquidity (16 bytes)
    const liquidity = parseU128(data, offset);
    offset += 16;

    // Parse sqrt price (16 bytes)
    const sqrtPrice = parseU128(data, offset);
    offset += 16;

    // Parse tick current index (4 bytes)
    const tickCurrentIndex = data.readInt32LE(offset);
    offset += 4;

    // Parse protocol fee owed A (8 bytes)
    const protocolFeeOwedA = parseU64(data, offset);
    offset += 8;

    // Parse protocol fee owed B (8 bytes)
    const protocolFeeOwedB = parseU64(data, offset);
    offset += 8;

    // Parse token mint A (32 bytes)
    const tokenMintA = data.slice(offset, offset + 32);
    offset += 32;

    // Parse token vault A (32 bytes)
    const tokenVaultA = data.slice(offset, offset + 32);
    offset += 32;

    // Parse fee growth global A (16 bytes)
    const feeGrowthGlobalA = parseU128(data, offset);
    offset += 16;

    // Parse token mint B (32 bytes)
    const tokenMintB = data.slice(offset, offset + 32);
    offset += 32;

    // Parse token vault B (32 bytes)
    const tokenVaultB = data.slice(offset, offset + 32);
    offset += 32;

    // Parse fee growth global B (16 bytes)
    const feeGrowthGlobalB = parseU128(data, offset);
    offset += 16;

    // Parse reward infos (3 rewards * 128 bytes each)
    const rewardInfos = [];
    for (let i = 0; i < 3; i++) {
      const mint = data.slice(offset, offset + 32);
      offset += 32;

      const vault = data.slice(offset, offset + 32);
      offset += 32;

      const authority = data.slice(offset, offset + 32);
      offset += 32;

      const emissionsPerSecondX64 = parseU128(data, offset);
      offset += 16;

      const growthGlobalX64 = parseU128(data, offset);
      offset += 16;

      rewardInfos.push({
        address: mint.toString('hex'),
        vault: vault.toString('hex'),
        authority: authority.toString('hex'),
        emissionsPerSecondX64,
        growthGlobalX64,
        amountOwed: '0' // Not stored at pool level
      });
    }

    // Parse tick arrays (up to 3 tick arrays)
    const tickArrays = [];
    for (let i = 0; i < 3; i++) {
      const tickArray = data.slice(offset, offset + 32);
      tickArrays.push(tickArray.toString('hex'));
      offset += 32;
    }

    // Parse reward last updated timestamp (8 bytes)
    const rewardLastUpdatedTimestamp = parseU64(data, offset);
    offset += 8;

    const tokenA = {
      address: tokenMintA.toString('hex'),
      vault: tokenVaultA.toString('hex'),
      decimals: 9, // Would fetch from mint
      symbol: 'UNKNOWN',
      reserve: '0' // Would calculate from vault
    };

    const tokenB = {
      address: tokenMintB.toString('hex'),
      vault: tokenVaultB.toString('hex'),
      decimals: 9, // Would fetch from mint
      symbol: 'UNKNOWN',
      reserve: '0' // Would calculate from vault
    };

    return {
      address: '', // Filled by caller
      programId: ORCA_WHIRLPOOL_PROGRAM_ID,
      tokenA,
      tokenB,
      tickSpacing,
      tickCurrent: tickCurrentIndex,
      sqrtPrice,
      liquidity,
      feeRate: feeRate / 10000, // Convert from basis points to percentage
      
      // Whirlpool specific
      whirlpoolsConfig: whirlpoolsConfig.toString('hex'),
      whirlpoolBump,
      tickArrays,
      protocolFeeRate: protocolFeeRate / 10000,
      rewardLastUpdatedTimestamp,
      rewardVaultBalances: rewardInfos.map(r => '0'), // Would fetch from vaults
      
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
      'Failed to parse Orca Whirlpool account',
      'orca-whirlpools',
      data,
      error as Error
    );
  }
}

/**
 * Parse Orca Position account data
 */
export function parsePositionAccount(data: Buffer): OrcaPosition {
  try {
    if (data.length < ORCA_SIZES.POSITION) {
      throw new Error(`Invalid position data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse whirlpool (32 bytes)
    const whirlpool = data.slice(offset, offset + 32);
    offset += 32;

    // Parse position mint (32 bytes)
    const positionMint = data.slice(offset, offset + 32);
    offset += 32;

    // Parse liquidity (16 bytes)
    const liquidity = parseU128(data, offset);
    offset += 16;

    // Parse tick lower index (4 bytes)
    const tickLowerIndex = data.readInt32LE(offset);
    offset += 4;

    // Parse tick upper index (4 bytes)
    const tickUpperIndex = data.readInt32LE(offset);
    offset += 4;

    // Parse fee growth checkpoint A (16 bytes)
    const feeGrowthCheckpointA = parseU128(data, offset);
    offset += 16;

    // Parse fee owed A (8 bytes)
    const feeOwedA = parseU64(data, offset);
    offset += 8;

    // Parse fee growth checkpoint B (16 bytes)
    const feeGrowthCheckpointB = parseU128(data, offset);
    offset += 16;

    // Parse fee owed B (8 bytes)
    const feeOwedB = parseU64(data, offset);
    offset += 8;

    // Parse reward infos (3 rewards)
    const rewardInfos = [];
    for (let i = 0; i < 3; i++) {
      const growthInsideCheckpoint = parseU128(data, offset);
      offset += 16;

      const amountOwed = parseU64(data, offset);
      offset += 8;

      rewardInfos.push({
        address: '', // Would get from pool
        vault: '',
        authority: '',
        emissionsPerSecondX64: '0',
        growthGlobalX64: growthInsideCheckpoint,
        amountOwed
      });
    }

    // Calculate prices from ticks
    const priceLower = Math.pow(1.0001, tickLowerIndex);
    const priceUpper = Math.pow(1.0001, tickUpperIndex);

    // Calculate token amounts (simplified - real calculation is complex)
    const liquidityNum = Number(liquidity);
    const midPrice = Math.sqrt(priceLower * priceUpper);
    
    // Rough approximation of token amounts
    const amountA = liquidityNum / Math.sqrt(midPrice);
    const amountB = liquidityNum * Math.sqrt(midPrice);

    const currentTime = Date.now();

    return {
      id: `orca-${whirlpool.toString('hex')}-${positionMint.toString('hex')}`,
      protocol: 'orca-whirlpools',
      chain: 'solana' as any,
      pool: whirlpool.toString('hex'),
      
      // Position amounts
      liquidity: Number(liquidity),
      value: 0, // Calculated later with prices
      feesEarned: Number(feeOwedA) + Number(feeOwedB),
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
      
      programId: ORCA_WHIRLPOOL_PROGRAM_ID,
      liquidity: liquidity,
      tickLower: tickLowerIndex,
      tickUpper: tickUpperIndex,
      feeGrowthInside0LastX64: feeGrowthCheckpointA,
      feeGrowthInside1LastX64: feeGrowthCheckpointB,
      tokensOwed0: feeOwedA,
      tokensOwed1: feeOwedB,
      rewards: [], // Would be populated from pool reward config
      
      // Whirlpool specific
      whirlpool: whirlpool.toString('hex'),
      positionMint: positionMint.toString('hex'),
      tickLowerIndex,
      tickUpperIndex,
      rewardInfos,
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime,
      updatedAt: currentTime
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Orca position account',
      'orca-whirlpools',
      data,
      error as Error
    );
  }
}

/**
 * Parse WhirlpoolsConfig account
 */
export function parseWhirlpoolsConfigAccount(data: Buffer): {
  feeAuthority: string;
  collectProtocolFeesAuthority: string;
  rewardEmissionsSuperAuthority: string;
  defaultProtocolFeeRate: number;
} {
  try {
    if (data.length < ORCA_SIZES.WHIRLPOOLS_CONFIG) {
      throw new Error(`Invalid WhirlpoolsConfig data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    const feeAuthority = data.slice(offset, offset + 32);
    offset += 32;

    const collectProtocolFeesAuthority = data.slice(offset, offset + 32);
    offset += 32;

    const rewardEmissionsSuperAuthority = data.slice(offset, offset + 32);
    offset += 32;

    const defaultProtocolFeeRate = data.readUInt16LE(offset);
    offset += 2;

    return {
      feeAuthority: feeAuthority.toString('hex'),
      collectProtocolFeesAuthority: collectProtocolFeesAuthority.toString('hex'),
      rewardEmissionsSuperAuthority: rewardEmissionsSuperAuthority.toString('hex'),
      defaultProtocolFeeRate
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse WhirlpoolsConfig account',
      'orca-whirlpools',
      data,
      error as Error
    );
  }
}

// ============================================================================
// ORCA SCANNING
// ============================================================================

/**
 * Scan for Orca Whirlpools
 */
export async function scanOrcaPools(
  context: SolanaContext
): Promise<OrcaPool[]> {
  try {
    const pools: OrcaPool[] = [];
    
    // Fetch all Whirlpool accounts
    const filters = [{
      dataSize: ORCA_SIZES.WHIRLPOOL
    }];
    
    const accounts = await fetchProgramAccounts(
      context,
      ORCA_WHIRLPOOL_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const poolAccounts = filterAccountsByDiscriminator(
      accounts,
      ORCA_DISCRIMINATORS.WHIRLPOOL
    );
    
    for (const { pubkey, account } of poolAccounts) {
      try {
        const pool = parseWhirlpoolAccount(account.data as Buffer);
        pool.address = pubkey;
        pools.push(pool);
      } catch (error) {
        console.warn(`Failed to parse Orca pool ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${pools.length} Orca Whirlpools`);
    return pools;
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to scan Orca pools',
      'orca-whirlpools',
      'SCAN_FAILED',
      error as Error
    );
  }
}

/**
 * Scan for Orca positions owned by a wallet
 */
export async function scanOrcaPositions(
  context: SolanaContext,
  walletAddress: string
): Promise<OrcaPosition[]> {
  try {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new SolanaIntegrationError(
        `Invalid wallet address: ${walletAddress}`,
        'orca-whirlpools',
        'INVALID_ADDRESS'
      );
    }

    const positions: OrcaPosition[] = [];
    
    // Strategy: Find position NFTs owned by the wallet
    // Orca positions are represented as NFTs
    const tokenAccounts = await context.connection.getTokenAccountsByOwner(
      walletAddress,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { commitment: context.commitment }
    );

    for (const { pubkey, account } of tokenAccounts.value) {
      try {
        // Check if this token has amount = 1 (NFT characteristic)
        const tokenInfo = account.data.parsed?.info;
        if (tokenInfo?.tokenAmount?.uiAmount === 1) {
          const positionMint = tokenInfo.address;
          
          // Try to find the position account for this NFT
          // Position accounts are PDAs derived from the mint
          const positionAccounts = await fetchProgramAccounts(
            context,
            ORCA_WHIRLPOOL_PROGRAM_ID,
            [
              {
                dataSize: ORCA_SIZES.POSITION
              },
              {
                memcmp: {
                  offset: 40, // Offset where position mint is stored
                  bytes: positionMint
                }
              }
            ]
          );

          for (const { pubkey: positionPubkey, account: positionAccount } of positionAccounts) {
            if (verifyAccountDiscriminator(positionAccount, ORCA_DISCRIMINATORS.POSITION)) {
              const position = parsePositionAccount(positionAccount.data as Buffer);
              position.accounts.position = positionPubkey;
              position.positionMint = positionMint;

              // Filter out empty positions
              if (Number(position.liquidity) > 0) {
                positions.push(position);
              }
            }
          }
        }
      } catch (error) {
        // Skip invalid tokens
        continue;
      }
    }
    
    console.log(`Found ${positions.length} Orca positions for wallet ${walletAddress}`);
    return positions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to scan Orca positions for wallet ${walletAddress}`,
      'orca-whirlpools',
      'SCAN_FAILED',
      error as Error
    );
  }
}

// ============================================================================
// ORCA POSITION ENRICHMENT
// ============================================================================

/**
 * Enrich position with pool data and current prices
 */
export async function enrichOrcaPosition(
  context: SolanaContext,
  position: OrcaPosition,
  priceFeeds?: Map<string, number>
): Promise<OrcaPosition> {
  try {
    // Fetch pool data
    const poolAccount = await fetchAccountInfo(context, position.pool);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${position.pool}`);
    }
    
    const pool = parseWhirlpoolAccount(poolAccount.data as Buffer);
    
    // Update position with pool info
    position.tokens.token0.address = pool.tokenA.address;
    position.tokens.token1.address = pool.tokenB.address;
    position.tokens.token0.decimals = pool.tokenA.decimals;
    position.tokens.token1.decimals = pool.tokenB.decimals;
    position.accounts.mint0 = pool.tokenA.address;
    position.accounts.mint1 = pool.tokenB.address;
    
    // Check if position is in range
    position.inRange = (pool.tickCurrent || 0) >= position.tickLowerIndex && 
                      (pool.tickCurrent || 0) <= position.tickUpperIndex;
    
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
    
    // Update reward info with pool data
    if (pool.rewardVaultBalances && pool.rewardVaultBalances.length > 0) {
      position.rewardInfos = position.rewardInfos?.map((reward, index) => {
        if (pool.rewardInfos && pool.rewardInfos[index]) {
          return {
            ...reward,
            address: pool.rewardInfos[index].address,
            vault: pool.rewardInfos[index].vault,
            authority: pool.rewardInfos[index].authority,
            emissionsPerSecondX64: pool.rewardInfos[index].emissionsPerSecondX64,
          };
        }
        return reward;
      }) || [];
    }
    
    return position;
  } catch (error) {
    console.warn(`Failed to enrich Orca position ${position.id}:`, error);
    return position;
  }
}

/**
 * Calculate position token amounts from liquidity and tick range
 */
export function calculateOrcaPositionAmounts(
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
      `Failed to calculate Orca position amounts`,
      'orca-whirlpools',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Get current pool state and price information
 */
export async function getOrcaPoolState(
  context: SolanaContext,
  poolAddress: string
): Promise<{
  pool: OrcaPool;
  currentPrice: number;
  tickCurrent: number;
  liquidity: string;
  sqrtPrice: string;
}> {
  try {
    const poolAccount = await fetchAccountInfo(context, poolAddress);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${poolAddress}`);
    }
    
    const pool = parseWhirlpoolAccount(poolAccount.data as Buffer);
    
    // Calculate current price from sqrt price
    const sqrtPriceNum = Number(pool.sqrtPrice) / Math.pow(2, 64);
    const currentPrice = sqrtPriceNum * sqrtPriceNum;
    
    return {
      pool,
      currentPrice,
      tickCurrent: pool.tickCurrent || 0,
      liquidity: pool.liquidity || '0',
      sqrtPrice: pool.sqrtPrice || '0'
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get Orca pool state for ${poolAddress}`,
      'orca-whirlpools',
      'POOL_STATE_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ORCA_WHIRLPOOL_PROGRAM_ID,
  ORCA_DISCRIMINATORS,
  ORCA_SIZES,
  
  // Parsers
  parseWhirlpoolAccount,
  parsePositionAccount,
  parseWhirlpoolsConfigAccount,
  
  // Scanners
  scanOrcaPools,
  scanOrcaPositions,
  
  // Enrichment
  enrichOrcaPosition,
  calculateOrcaPositionAmounts,
  getOrcaPoolState,
};