/**
 * Jupiter Perpetual Futures Integration
 * Handles Jupiter perpetual positions and trading data
 */

import {
  SolanaAccountInfo,
  SolanaContext,
  JupiterPosition,
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
// JUPITER CONSTANTS
// ============================================================================

export const JUPITER_PERP_PROGRAM_ID = SOLANA_PROGRAMS.JUPITER_PERP;

// Account discriminators (first 8 bytes of account data)
export const JUPITER_DISCRIMINATORS = {
  PERPETUALS: Buffer.from([0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70, 0x81]), // Perpetuals
  CUSTODY: Buffer.from([0x2a, 0x3b, 0x4c, 0x5d, 0x6e, 0x7f, 0x80, 0x91]), // Custody
  POSITION: Buffer.from([0x3a, 0x4b, 0x5c, 0x6d, 0x7e, 0x8f, 0x90, 0xa1]), // Position
  POOL: Buffer.from([0x4a, 0x5b, 0x6c, 0x7d, 0x8e, 0x9f, 0xa0, 0xb1]), // Pool
};

// Data structure sizes
export const JUPITER_SIZES = {
  PERPETUALS: 200,
  CUSTODY: 320,
  POSITION: 200,
  POOL: 400,
};

// Position sides
export enum PositionSide {
  None = 0,
  Long = 1,
  Short = 2,
}

// Position status
export enum PositionStatus {
  None = 0,
  Open = 1,
  Liquidated = 2,
  Closed = 3,
}

// ============================================================================
// JUPITER ACCOUNT PARSERS
// ============================================================================

/**
 * Parse Jupiter Perpetuals account data
 */
export function parsePerpetualsAccount(data: Buffer): {
  permissions: string;
  allowSwap: boolean;
  allowAddLiquidity: boolean;
  allowRemoveLiquidity: boolean;
  allowOpenPosition: boolean;
  allowClosePosition: boolean;
  allowPnlWithdrawal: boolean;
  allowCollateralWithdrawal: boolean;
  allowSizeChange: boolean;
  pools: string[];
} {
  try {
    if (data.length < JUPITER_SIZES.PERPETUALS) {
      throw new Error(`Invalid Perpetuals data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    const permissions = data.slice(offset, offset + 32);
    offset += 32;

    const flags = data.readUInt8(offset);
    offset += 1;

    const allowSwap = (flags & 0x01) !== 0;
    const allowAddLiquidity = (flags & 0x02) !== 0;
    const allowRemoveLiquidity = (flags & 0x04) !== 0;
    const allowOpenPosition = (flags & 0x08) !== 0;
    const allowClosePosition = (flags & 0x10) !== 0;
    const allowPnlWithdrawal = (flags & 0x20) !== 0;
    const allowCollateralWithdrawal = (flags & 0x40) !== 0;
    const allowSizeChange = (flags & 0x80) !== 0;

    // Parse pools array (assuming up to 16 pools)
    const pools = [];
    const poolCount = data.readUInt8(offset);
    offset += 1;

    for (let i = 0; i < poolCount && i < 16; i++) {
      const poolAddress = data.slice(offset, offset + 32);
      pools.push(poolAddress.toString('hex'));
      offset += 32;
    }

    return {
      permissions: permissions.toString('hex'),
      allowSwap,
      allowAddLiquidity,
      allowRemoveLiquidity,
      allowOpenPosition,
      allowClosePosition,
      allowPnlWithdrawal,
      allowCollateralWithdrawal,
      allowSizeChange,
      pools
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Jupiter Perpetuals account',
      'jupiter',
      data,
      error as Error
    );
  }
}

/**
 * Parse Jupiter Position account data
 */
export function parseJupiterPositionAccount(data: Buffer): JupiterPosition {
  try {
    if (data.length < JUPITER_SIZES.POSITION) {
      throw new Error(`Invalid position data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse owner
    const owner = data.slice(offset, offset + 32);
    offset += 32;

    // Parse pool
    const pool = data.slice(offset, offset + 32);
    offset += 32;

    // Parse custody
    const custody = data.slice(offset, offset + 32);
    offset += 32;

    // Parse collateral mint
    const collateralMint = data.slice(offset, offset + 32);
    offset += 32;

    // Parse collateral amount
    const collateralAmount = parseU64(data, offset);
    offset += 8;

    // Parse size USD
    const sizeUsd = parseU64(data, offset);
    offset += 8;

    // Parse collateral USD
    const collateralUsd = parseU64(data, offset);
    offset += 8;

    // Parse unrealized PnL USD (signed)
    const unrealizedPnlUsd = parseI64(data, offset);
    offset += 8;

    // Parse realized PnL USD (signed)
    const realizedPnlUsd = parseI64(data, offset);
    offset += 8;

    // Parse side (1 byte)
    const sideValue = data.readUInt8(offset);
    offset += 1;

    const side = sideValue === 1 ? 'long' : sideValue === 2 ? 'short' : 'none';

    // Parse entry price
    const entryPrice = parseU64(data, offset);
    offset += 8;

    // Parse mark price
    const markPrice = parseU64(data, offset);
    offset += 8;

    // Parse liquidation price
    const liquidationPrice = parseU64(data, offset);
    offset += 8;

    // Parse timestamps
    const openTime = parseU64(data, offset);
    offset += 8;

    const lastUpdateTime = parseU64(data, offset);
    offset += 8;

    // Parse bump
    const bump = data.readUInt8(offset);
    offset += 1;

    const currentTime = Date.now();

    return {
      id: `jupiter-${pool.toString('hex')}-${owner.toString('hex')}`,
      protocol: 'jupiter',
      chain: 'solana' as any,
      pool: pool.toString('hex'),
      
      // Position data (Jupiter perps don't have traditional liquidity)
      liquidity: 0,
      value: Number(collateralUsd) / 1e6, // Convert from micro USD
      feesEarned: Math.max(0, Number(realizedPnlUsd) / 1e6), // Positive PnL as "fees"
      apr: 0, // Would calculate based on performance
      inRange: true, // Perp positions are always "active"
      
      // Tokens (for Jupiter perps, we show collateral)
      tokens: {
        token0: {
          address: collateralMint.toString('hex'),
          symbol: 'UNKNOWN',
          amount: Number(collateralAmount),
          decimals: 6 // Assume USDC
        },
        token1: {
          address: '', // No second token for perps
          symbol: '',
          amount: 0,
          decimals: 0
        }
      },

      // Solana-specific
      accounts: {
        position: '', // Filled by caller
        mint0: collateralMint.toString('hex'),
        mint1: '',
      },
      
      programId: JUPITER_PERP_PROGRAM_ID,
      rewards: [], // No traditional rewards for perps
      
      // Jupiter perp specific
      perpetuals: '', // Would be filled from context
      custody: custody.toString('hex'),
      owner: owner.toString('hex'),
      collateralMint: collateralMint.toString('hex'),
      collateralAmount,
      sizeUsd,
      collateralUsd,
      unrealizedPnlUsd,
      realizedPnlUsd,
      side: side as 'long' | 'short',
      entryPrice,
      markPrice,
      liquidationPrice,
      openTime: Number(openTime),
      lastUpdateTime: Number(lastUpdateTime),
      
      // Metadata
      lastSlot: 0,
      createdAt: currentTime.toString(),
      updatedAt: currentTime.toString()
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Jupiter position account',
      'jupiter',
      data,
      error as Error
    );
  }
}

/**
 * Parse Jupiter Custody account data
 */
export function parseCustodyAccount(data: Buffer): {
  pool: string;
  mint: string;
  tokenAccount: string;
  decimals: number;
  isStable: boolean;
  oracle: string;
  pricing: {
    useEma: boolean;
    useUnrealizedPnlForAum: boolean;
    thresholdAmount: string;
    minPrice: string;
    maxPrice: string;
  };
  permissions: {
    allowSwap: boolean;
    allowAddLiquidity: boolean;
    allowRemoveLiquidity: boolean;
  };
  fees: {
    swapIn: string;
    swapOut: string;
    stableSwapIn: string;
    stableSwapOut: string;
    addLiquidity: string;
    removeLiquidity: string;
    openPosition: string;
    closePosition: string;
    liquidation: string;
  };
  borrowRate: {
    baseRate: string;
    slope1: string;
    slope2: string;
    optimalUtilization: string;
  };
  assets: {
    owned: string;
    locked: string;
  };
  collectedFees: {
    swapUsd: string;
    addRemoveUsd: string;
    openPositionUsd: string;
    closePositionUsd: string;
    liquidationUsd: string;
    borrowUsd: string;
  };
  volumeStats: {
    swapUsd: string;
    addLiquidityUsd: string;
    removeLiquidityUsd: string;
    openPositionUsd: string;
    closePositionUsd: string;
    liquidationUsd: string;
  };
  tradeStats: {
    profitUsd: string;
    lossUsd: string;
    oiLongUsd: string;
    oiShortUsd: string;
  };
} {
  try {
    if (data.length < JUPITER_SIZES.CUSTODY) {
      throw new Error(`Invalid Custody data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator

    // Parse basic info
    const pool = data.slice(offset, offset + 32);
    offset += 32;

    const mint = data.slice(offset, offset + 32);
    offset += 32;

    const tokenAccount = data.slice(offset, offset + 32);
    offset += 32;

    const decimals = data.readUInt8(offset);
    offset += 1;

    const isStable = data.readUInt8(offset) !== 0;
    offset += 1;

    const oracle = data.slice(offset, offset + 32);
    offset += 32;

    // Parse pricing config
    const pricingFlags = data.readUInt8(offset);
    offset += 1;

    const useEma = (pricingFlags & 0x01) !== 0;
    const useUnrealizedPnlForAum = (pricingFlags & 0x02) !== 0;

    const thresholdAmount = parseU64(data, offset);
    offset += 8;

    const minPrice = parseU64(data, offset);
    offset += 8;

    const maxPrice = parseU64(data, offset);
    offset += 8;

    // Parse permissions
    const permissionFlags = data.readUInt8(offset);
    offset += 1;

    const allowSwap = (permissionFlags & 0x01) !== 0;
    const allowAddLiquidity = (permissionFlags & 0x02) !== 0;
    const allowRemoveLiquidity = (permissionFlags & 0x04) !== 0;

    // Parse fees (multiple fee types)
    const swapIn = parseU64(data, offset);
    offset += 8;

    const swapOut = parseU64(data, offset);
    offset += 8;

    const stableSwapIn = parseU64(data, offset);
    offset += 8;

    const stableSwapOut = parseU64(data, offset);
    offset += 8;

    const addLiquidity = parseU64(data, offset);
    offset += 8;

    const removeLiquidity = parseU64(data, offset);
    offset += 8;

    const openPosition = parseU64(data, offset);
    offset += 8;

    const closePosition = parseU64(data, offset);
    offset += 8;

    const liquidation = parseU64(data, offset);
    offset += 8;

    // Parse borrow rate config
    const baseRate = parseU64(data, offset);
    offset += 8;

    const slope1 = parseU64(data, offset);
    offset += 8;

    const slope2 = parseU64(data, offset);
    offset += 8;

    const optimalUtilization = parseU64(data, offset);
    offset += 8;

    // Parse assets
    const owned = parseU64(data, offset);
    offset += 8;

    const locked = parseU64(data, offset);
    offset += 8;

    // Parse collected fees
    const swapUsd = parseU64(data, offset);
    offset += 8;

    const addRemoveUsd = parseU64(data, offset);
    offset += 8;

    const openPositionUsd = parseU64(data, offset);
    offset += 8;

    const closePositionUsd = parseU64(data, offset);
    offset += 8;

    const liquidationUsd = parseU64(data, offset);
    offset += 8;

    const borrowUsd = parseU64(data, offset);
    offset += 8;

    // Parse volume stats (simplified, assuming similar structure)
    // ... (would continue parsing all volume and trade stats)

    return {
      pool: pool.toString('hex'),
      mint: mint.toString('hex'),
      tokenAccount: tokenAccount.toString('hex'),
      decimals,
      isStable,
      oracle: oracle.toString('hex'),
      pricing: {
        useEma,
        useUnrealizedPnlForAum,
        thresholdAmount,
        minPrice,
        maxPrice,
      },
      permissions: {
        allowSwap,
        allowAddLiquidity,
        allowRemoveLiquidity,
      },
      fees: {
        swapIn,
        swapOut,
        stableSwapIn,
        stableSwapOut,
        addLiquidity,
        removeLiquidity,
        openPosition,
        closePosition,
        liquidation,
      },
      borrowRate: {
        baseRate,
        slope1,
        slope2,
        optimalUtilization,
      },
      assets: {
        owned,
        locked,
      },
      collectedFees: {
        swapUsd,
        addRemoveUsd,
        openPositionUsd,
        closePositionUsd,
        liquidationUsd,
        borrowUsd,
      },
      volumeStats: {
        swapUsd: '0', // Simplified
        addLiquidityUsd: '0',
        removeLiquidityUsd: '0',
        openPositionUsd: '0',
        closePositionUsd: '0',
        liquidationUsd: '0',
      },
      tradeStats: {
        profitUsd: '0', // Simplified
        lossUsd: '0',
        oiLongUsd: '0',
        oiShortUsd: '0',
      },
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse Jupiter Custody account',
      'jupiter',
      data,
      error as Error
    );
  }
}

// ============================================================================
// JUPITER SCANNING
// ============================================================================

/**
 * Scan for Jupiter perpetual positions owned by a wallet
 */
export async function scanJupiterPositions(
  context: SolanaContext,
  walletAddress: string
): Promise<JupiterPosition[]> {
  try {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new SolanaIntegrationError(
        `Invalid wallet address: ${walletAddress}`,
        'jupiter',
        'INVALID_ADDRESS'
      );
    }

    const positions: JupiterPosition[] = [];
    
    // Scan for position accounts owned by the wallet
    const filters = [
      {
        dataSize: JUPITER_SIZES.POSITION
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
      JUPITER_PERP_PROGRAM_ID,
      filters
    );
    
    // Filter by discriminator and parse
    const positionAccounts = filterAccountsByDiscriminator(
      accounts,
      JUPITER_DISCRIMINATORS.POSITION
    );
    
    for (const { pubkey, account } of positionAccounts) {
      try {
        const position = parseJupiterPositionAccount(account.data as Buffer);
        position.accounts.position = pubkey;
        
        // Filter out closed positions
        if (Number(position.sizeUsd) > 0 || Number(position.collateralAmount) > 0) {
          positions.push(position);
        }
      } catch (error) {
        console.warn(`Failed to parse Jupiter position ${pubkey}:`, error);
      }
    }
    
    console.log(`Found ${positions.length} Jupiter positions for wallet ${walletAddress}`);
    return positions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to scan Jupiter positions for wallet ${walletAddress}`,
      'jupiter',
      'SCAN_FAILED',
      error as Error
    );
  }
}

/**
 * Get Jupiter pool information
 */
export async function getJupiterPoolInfo(
  context: SolanaContext,
  poolAddress: string
): Promise<{
  perpetuals: any;
  custodies: Array<any>;
  totalAum: number;
  fees24h: number;
  volume24h: number;
}> {
  try {
    // Fetch perpetuals config
    const perpetualsAccount = await fetchAccountInfo(context, poolAddress);
    if (!perpetualsAccount) {
      throw new Error(`Perpetuals account not found: ${poolAddress}`);
    }
    
    const perpetuals = parsePerpetualsAccount(perpetualsAccount.data as Buffer);
    
    // Fetch custody accounts for each pool
    const custodies = [];
    for (const custodyAddress of perpetuals.pools.slice(0, 5)) { // Limit to first 5
      try {
        const custodyAccount = await fetchAccountInfo(context, custodyAddress);
        if (custodyAccount) {
          const custody = parseCustodyAccount(custodyAccount.data as Buffer);
          custodies.push(custody);
        }
      } catch (error) {
        console.warn(`Failed to fetch custody ${custodyAddress}:`, error);
      }
    }
    
    // Calculate aggregate metrics
    let totalAum = 0;
    let fees24h = 0;
    let volume24h = 0;
    
    for (const custody of custodies) {
      const ownedValue = Number(custody.assets.owned) / Math.pow(10, custody.decimals);
      totalAum += ownedValue;
      
      // Sum up various fee types (simplified)
      fees24h += Number(custody.collectedFees.swapUsd) / 1e6;
      fees24h += Number(custody.collectedFees.openPositionUsd) / 1e6;
      fees24h += Number(custody.collectedFees.closePositionUsd) / 1e6;
      
      // Sum up volume (simplified)
      volume24h += Number(custody.volumeStats.swapUsd) / 1e6;
      volume24h += Number(custody.volumeStats.openPositionUsd) / 1e6;
      volume24h += Number(custody.volumeStats.closePositionUsd) / 1e6;
    }
    
    return {
      perpetuals,
      custodies,
      totalAum,
      fees24h,
      volume24h
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get Jupiter pool info for ${poolAddress}`,
      'jupiter',
      'POOL_INFO_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// POSITION ANALYSIS
// ============================================================================

/**
 * Calculate Jupiter position metrics
 */
export function calculateJupiterPositionMetrics(
  position: JupiterPosition,
  collateralPrice: number = 1 // Assume USD stablecoin
): {
  positionValue: number;
  pnl: number;
  pnlPercent: number;
  leverage: number;
  liquidationRisk: number;
  margin: number;
  marginRatio: number;
  timeInPosition: number;
} {
  try {
    // Convert from micro USD to USD
    const sizeUsd = Number(position.sizeUsd) / 1e6;
    const collateralUsd = Number(position.collateralUsd) / 1e6;
    const unrealizedPnl = Number(position.unrealizedPnlUsd) / 1e6;
    const realizedPnl = Number(position.realizedPnlUsd) / 1e6;
    
    // Calculate position value (collateral + unrealized PnL)
    const positionValue = collateralUsd + unrealizedPnl;
    
    // Total PnL
    const pnl = unrealizedPnl + realizedPnl;
    const pnlPercent = collateralUsd > 0 ? (pnl / collateralUsd) * 100 : 0;
    
    // Calculate leverage
    const leverage = sizeUsd > 0 && positionValue > 0 ? sizeUsd / positionValue : 0;
    
    // Calculate liquidation risk (simplified)
    const entryPriceNum = Number(position.entryPrice) / 1e6;
    const markPriceNum = Number(position.markPrice) / 1e6;
    const liquidationPriceNum = Number(position.liquidationPrice) / 1e6;
    
    let liquidationRisk = 0;
    if (liquidationPriceNum > 0 && markPriceNum > 0) {
      const priceDistance = Math.abs(markPriceNum - liquidationPriceNum);
      const priceRatio = priceDistance / markPriceNum;
      liquidationRisk = Math.max(0, 1 - priceRatio); // Higher risk = closer to liquidation
    }
    
    // Calculate margin and margin ratio
    const margin = collateralUsd;
    const marginRatio = sizeUsd > 0 ? margin / sizeUsd : 0;
    
    // Time in position (days)
    const timeInPosition = (Date.now() - position.openTime) / (1000 * 60 * 60 * 24);
    
    return {
      positionValue,
      pnl,
      pnlPercent,
      leverage,
      liquidationRisk,
      margin,
      marginRatio,
      timeInPosition
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to calculate metrics for Jupiter position ${position.id}`,
      'jupiter',
      'CALCULATION_ERROR',
      error as Error
    );
  }
}

/**
 * Format Jupiter position for display
 */
export function formatJupiterPosition(
  position: JupiterPosition,
  metrics: ReturnType<typeof calculateJupiterPositionMetrics>
): {
  summary: string;
  details: Array<{ label: string; value: string }>;
  riskInfo: {
    leverage: string;
    liquidationPrice: string;
    liquidationRisk: string;
    margin: string;
  };
} {
  try {
    const side = position.side.toUpperCase();
    const pnlSign = metrics.pnl >= 0 ? '+' : '';
    
    const summary = `${side} position with ${pnlSign}$${metrics.pnl.toFixed(2)} PnL (${pnlSign}${metrics.pnlPercent.toFixed(2)}%)`;

    const details = [
      { label: 'Position Value', value: `$${metrics.positionValue.toFixed(2)}` },
      { label: 'Size', value: `$${(Number(position.sizeUsd) / 1e6).toFixed(2)}` },
      { label: 'Collateral', value: `$${(Number(position.collateralUsd) / 1e6).toFixed(2)}` },
      { label: 'PnL', value: `${pnlSign}$${metrics.pnl.toFixed(2)}` },
      { label: 'Leverage', value: `${metrics.leverage.toFixed(2)}x` },
      { label: 'Entry Price', value: `$${(Number(position.entryPrice) / 1e6).toFixed(4)}` },
      { label: 'Mark Price', value: `$${(Number(position.markPrice) / 1e6).toFixed(4)}` },
      { label: 'Time in Position', value: `${metrics.timeInPosition.toFixed(1)} days` },
    ];

    const riskInfo = {
      leverage: `${metrics.leverage.toFixed(2)}x`,
      liquidationPrice: `$${(Number(position.liquidationPrice) / 1e6).toFixed(4)}`,
      liquidationRisk: `${(metrics.liquidationRisk * 100).toFixed(1)}%`,
      margin: `$${metrics.margin.toFixed(2)}`,
    };

    return {
      summary,
      details,
      riskInfo
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to format Jupiter position ${position.id}`,
      'jupiter',
      'FORMAT_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  JUPITER_PERP_PROGRAM_ID,
  JUPITER_DISCRIMINATORS,
  JUPITER_SIZES,
  PositionSide,
  PositionStatus,
  
  // Parsers
  parsePerpetualsAccount,
  parseJupiterPositionAccount,
  parseCustodyAccount,
  
  // Scanners
  scanJupiterPositions,
  getJupiterPoolInfo,
  
  // Analysis
  calculateJupiterPositionMetrics,
  formatJupiterPosition,
};