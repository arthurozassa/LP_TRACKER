/**
 * Meteora Dynamic Liquidity Market Maker (DLMM) Integration
 * Handles DLMM pool scanning and position parsing
 */

import {
  SolanaAccountInfo,
  SolanaContext,
  MeteoraPosition,
  MeteoraPool,
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
  calculatePositionValue,
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
// METEORA CONSTANTS
// ============================================================================

export const METEORA_PROGRAM_ID = SOLANA_PROGRAMS.METEORA_DLMM;

// Account discriminators (first 8 bytes of account data)
export const METEORA_DISCRIMINATORS = {
  LB_PAIR: Buffer.from([0x7b, 0x7a, 0x37, 0x2a, 0x5d, 0x8c, 0x1a, 0xb1]), // LbPair
  POSITION: Buffer.from([0xc3, 0x97, 0x2e, 0x1e, 0x37, 0x3f, 0x4d, 0x2a]), // Position  
  BIN_ARRAY: Buffer.from([0x8d, 0x4a, 0x7c, 0x65, 0x91, 0x3e, 0x2f, 0x1b]), // BinArray
  ORACLE: Buffer.from([0x9a, 0x8c, 0x4f, 0x2b, 0x6e, 0x1d, 0x8a, 0x3c]), // Oracle
};

// Data structure sizes
export const METEORA_SIZES = {
  LB_PAIR: 864,
  POSITION: 312,
  BIN_ARRAY: 40 + (70 * 1024), // Header + bins
  BIN: 24,
};

// ============================================================================
// METEORA ACCOUNT PARSERS
// ============================================================================

/**
 * Parse Meteora LbPair (Pool) account data
 */
export function parseLbPairAccount(data: Buffer): MeteoraPool {
  try {
    if (data.length < METEORA_SIZES.LB_PAIR) {
      throw new Error(`Invalid LbPair data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse basic pool data
    const parameters = data.slice(offset, offset + 32);
    offset += 32;

    const vaultX = data.slice(offset, offset + 32);
    offset += 32;
    
    const vaultY = data.slice(offset, offset + 32);
    offset += 32;

    const mintX = data.slice(offset, offset + 32);
    offset += 32;

    const mintY = data.slice(offset, offset + 32);
    offset += 32;

    const binStep = data.readUInt16LE(offset);
    offset += 2;

    const baseFactor = data.readUInt16LE(offset);
    offset += 2;

    const filterPeriod = data.readUInt16LE(offset);
    offset += 2;

    const decayPeriod = data.readUInt16LE(offset);
    offset += 2;

    const reductionFactor = data.readUInt16LE(offset);
    offset += 2;

    const variableFeeControl = data.readUInt32LE(offset);
    offset += 4;

    const maxVolatilityAccumulator = data.readUInt32LE(offset);
    offset += 4;

    const minBinId = data.readInt32LE(offset);
    offset += 4;

    const maxBinId = data.readInt32LE(offset);
    offset += 4;

    const protocolFee = data.readUInt32LE(offset);
    offset += 4;

    const activeId = data.readInt32LE(offset);
    offset += 4;

    const binArrayBitmap = data.slice(offset, offset + 512);
    offset += 512;

    const reserveX = parseU64(data, offset);
    offset += 8;

    const reserveY = parseU64(data, offset);
    offset += 8;

    const oracle = data.slice(offset, offset + 32);
    offset += 32;

    // Mock token info (would be fetched from registry)
    const tokenA = {
      mint: mintX.toString('hex'),
      vault: vaultX.toString('hex'),
      decimals: 9, // Would fetch from mint
      symbol: 'UNKNOWN',
      reserve: reserveX
    };

    const tokenB = {
      mint: mintY.toString('hex'),
      vault: vaultY.toString('hex'),
      decimals: 9, // Would fetch from mint
      symbol: 'UNKNOWN',
      reserve: reserveY
    };

    return {
      address: '', // Filled by caller
      programId: METEORA_PROGRAM_ID,
      tokenA,
      tokenB,
      binStep,
      activeId,
      feeRate: protocolFee / 10000, // Convert basis points to percentage
      
      // DLMM specific
      reserve: {
        tokenX: reserveX,
        tokenY: reserveY
      },
      binArray: binArrayBitmap.toString('hex'),
      oracle: oracle.toString('hex'),
      parameters: {
        baseFactor,
        filterPeriod,
        decayPeriod,
        reductionFactor,
        variableFeeControl,
        maxVolatilityAccumulator,
        minBinId,
        maxBinId
      },

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
      'Failed to parse Meteora LbPair account',
      ProtocolType.METEORA,
      data,
      error as Error
    );
  }
}

/**
 * Parse Meteora Position account data
 */
export function parsePositionAccount(data: Buffer): MeteoraPosition {
  try {
    if (data.length < METEORA_SIZES.POSITION) {
      throw new Error(`Invalid position data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse position owner
    const owner = data.slice(offset, offset + 32);
    offset += 32;

    // Parse LbPair (pool)
    const lbPair = data.slice(offset, offset + 32);
    offset += 32;

    // Parse liquidity
    const liquidity = parseU128(data, offset);
    offset += 16;

    // Parse fee info
    const feeInfos = [];
    for (let i = 0; i < 2; i++) {
      const feeGrowthInside = parseU128(data, offset);
      offset += 16;
      const feeOwed = parseU64(data, offset);
      offset += 8;
      
      feeInfos.push({
        feeGrowthInside,
        feeOwed
      });
    }

    // Parse reward infos (up to 2 rewards)
    const rewards = [];
    for (let i = 0; i < 2; i++) {
      const mint = data.slice(offset, offset + 32);
      offset += 32;
      
      const vault = data.slice(offset, offset + 32);
      offset += 32;
      
      const authority = data.slice(offset, offset + 32);
      offset += 32;
      
      const emissions = parseU128(data, offset);
      offset += 16;
      
      const growthGlobalX64 = parseU128(data, offset);
      offset += 16;
      
      const amountOwed = parseU64(data, offset);
      offset += 8;

      rewards.push({
        mint: mint.toString('hex'),
        vault: vault.toString('hex'),
        authority: authority.toString('hex'),
        emissions,
        growthGlobalX64,
        amountOwed
      });
    }

    // Parse bin positions
    const binPositions = [];
    const numBinPositions = data.readUInt32LE(offset);
    offset += 4;

    for (let i = 0; i < numBinPositions; i++) {
      const binId = data.readInt32LE(offset);
      offset += 4;
      
      const xAmount = parseU64(data, offset);
      offset += 8;
      
      const yAmount = parseU64(data, offset);
      offset += 8;
      
      const binLiquidity = parseU128(data, offset);
      offset += 16;
      
      const feeX = parseU64(data, offset);
      offset += 8;
      
      const feeY = parseU64(data, offset);
      offset += 8;

      // Calculate price for this bin
      const price = Math.pow(1.0001, binId);

      binPositions.push({
        binId,
        xAmount,
        yAmount,
        price,
        liquidity: binLiquidity,
        feeX,
        feeY
      });
    }

    // Calculate total fees and amounts
    const totalFeesX = feeInfos.reduce((sum, fee) => sum + Number(fee.feeOwed), 0);
    const totalFeesY = 0; // Would calculate from fee info

    const totalAmountX = binPositions.reduce((sum, pos) => sum + Number(pos.xAmount), 0);
    const totalAmountY = binPositions.reduce((sum, pos) => sum + Number(pos.yAmount), 0);

    const currentTime = Date.now();

    return {
      id: `meteora-${lbPair.toString('hex')}-${owner.toString('hex')}`,
      protocol: ProtocolType.METEORA,
      chain: ChainType.SOLANA,
      pool: lbPair.toString('hex'),
      
      // Position amounts
      liquidity: Number(liquidity),
      value: 0, // Calculated later with prices
      feesEarned: totalFeesX + totalFeesY,
      apr: 0, // Calculated later
      inRange: true, // DLMM is always "in range"
      
      // Tokens
      tokens: {
        token0: {
          mint: '', // Would get from pool info
          symbol: 'UNKNOWN',
          amount: totalAmountX,
          decimals: 9
        },
        token1: {
          mint: '', // Would get from pool info
          symbol: 'UNKNOWN',
          amount: totalAmountY,
          decimals: 9
        }
      },

      // Solana-specific
      accounts: {
        position: '', // Filled by caller
        mint0: '', // Would get from pool
        mint1: '', // Would get from pool
      },
      
      programId: METEORA_PROGRAM_ID,
      liquidity: liquidity,
      rewards,
      
      // DLMM specific
      binStep: 0, // Would get from pool
      activeId: 0, // Would get from pool
      minBinId: Math.min(...binPositions.map(p => p.binId)),
      maxBinId: Math.max(...binPositions.map(p => p.binId)),
      binPositions,
      unclaimedFees: {
        tokenX: feeInfos[0]?.feeOwed || '0',
        tokenY: feeInfos[1]?.feeOwed || '0'
      },
      unclaimedRewards: rewards
        .filter(r => Number(r.amountOwed) > 0)
        .map(r => ({
          mint: r.mint,
          amount: r.amountOwed
        })),
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime,
      updatedAt: currentTime
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Meteora position account',
      ProtocolType.METEORA,
      data,
      error as Error
    );
  }
}

// ============================================================================
// METEORA SCANNING
// ============================================================================

/**
 * Scan for Meteora pools
 */
export async function scanMeteoraPools(
  context: SolanaContext
): Promise<MeteoraPool[]> {
  try {
    const pools: MeteoraPool[] = [];
    
    // Fetch all LbPair accounts
    const filters = [{
      dataSize: METEORA_SIZES.LB_PAIR
    }];
    
    const accounts = await fetchProgramAccounts(
      context,
      METEORA_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const lbPairAccounts = filterAccountsByDiscriminator(
      accounts,
      METEORA_DISCRIMINATORS.LB_PAIR
    );
    
    for (const { pubkey, account } of lbPairAccounts) {
      try {
        const pool = parseLbPairAccount(account.data as Buffer);
        pool.address = pubkey;
        pools.push(pool);
      } catch (error) {
        console.warn(`Failed to parse Meteora pool ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${pools.length} Meteora pools`);
    return pools;
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to scan Meteora pools',
      ProtocolType.METEORA,
      'SCAN_FAILED',
      error as Error
    );
  }
}

/**
 * Scan for Meteora positions owned by a wallet
 */
export async function scanMeteoraPositions(
  context: SolanaContext,
  walletAddress: string
): Promise<MeteoraPosition[]> {
  try {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new SolanaIntegrationError(
        `Invalid wallet address: ${walletAddress}`,
        ProtocolType.METEORA,
        'INVALID_ADDRESS'
      );
    }

    const positions: MeteoraPosition[] = [];
    
    // Scan for position accounts owned by the wallet
    const filters = [
      {
        dataSize: METEORA_SIZES.POSITION
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
      METEORA_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const positionAccounts = filterAccountsByDiscriminator(
      accounts,
      METEORA_DISCRIMINATORS.POSITION
    );
    
    for (const { pubkey, account } of positionAccounts) {
      try {
        const position = parsePositionAccount(account.data as Buffer);
        position.accounts.position = pubkey;
        
        // Filter out empty positions
        if (Number(position.liquidity) > 0 || position.binPositions.length > 0) {
          positions.push(position);
        }
      } catch (error) {
        console.warn(`Failed to parse Meteora position ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${positions.length} Meteora positions for wallet ${walletAddress}`);
    return positions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to scan Meteora positions for wallet ${walletAddress}`,
      ProtocolType.METEORA,
      'SCAN_FAILED',
      error as Error
    );
  }
}

// ============================================================================
// METEORA POSITION ENRICHMENT
// ============================================================================

/**
 * Enrich position with pool data and current prices
 */
export async function enrichMeteoraPosition(
  context: SolanaContext,
  position: MeteoraPosition,
  priceFeeds?: Map<string, number>
): Promise<MeteoraPosition> {
  try {
    // Fetch pool data
    const poolAccount = await fetchAccountInfo(context, position.pool);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${position.pool}`);
    }
    
    const pool = parseLbPairAccount(poolAccount.data as Buffer);
    
    // Update position with pool info
    position.binStep = pool.binStep;
    position.activeId = pool.activeId;
    position.tokens.token0.mint = pool.tokenA.mint;
    position.tokens.token1.mint = pool.tokenB.mint;
    position.accounts.mint0 = pool.tokenA.mint;
    position.accounts.mint1 = pool.tokenB.mint;
    
    // Calculate position value if prices are available
    if (priceFeeds) {
      const token0Price = priceFeeds.get(pool.tokenA.mint) || 0;
      const token1Price = priceFeeds.get(pool.tokenB.mint) || 0;
      
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
    
    return position;
  } catch (error) {
    console.warn(`Failed to enrich Meteora position ${position.id}:`, error);
    return position;
  }
}

/**
 * Get current bin prices for a Meteora pool
 */
export async function getMeteoraPoolPrices(
  context: SolanaContext,
  poolAddress: string
): Promise<{ activeId: number; binPrices: Map<number, number> }> {
  try {
    const poolAccount = await fetchAccountInfo(context, poolAddress);
    if (!poolAccount) {
      throw new Error(`Pool account not found: ${poolAddress}`);
    }
    
    const pool = parseLbPairAccount(poolAccount.data as Buffer);
    const binPrices = new Map<number, number>();
    
    // Calculate prices for relevant bins around active bin
    const startId = pool.activeId - 100;
    const endId = pool.activeId + 100;
    
    for (let binId = startId; binId <= endId; binId++) {
      const price = Math.pow(1.0001, binId);
      binPrices.set(binId, price);
    }
    
    return {
      activeId: pool.activeId,
      binPrices
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get Meteora pool prices for ${poolAddress}`,
      ProtocolType.METEORA,
      'PRICE_FETCH_FAILED',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  METEORA_PROGRAM_ID,
  METEORA_DISCRIMINATORS,
  METEORA_SIZES,
  
  // Parsers
  parseLbPairAccount,
  parsePositionAccount,
  
  // Scanners
  scanMeteoraPools,
  scanMeteoraPositions,
  
  // Enrichment
  enrichMeteoraPosition,
  getMeteoraPoolPrices,
};