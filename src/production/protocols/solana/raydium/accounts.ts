/**
 * Raydium Account Parsing Utilities
 * Specialized account parsing for Raydium CLMM protocol
 */

import {
  SolanaAccountInfo,
  SolanaContext,
  RaydiumPosition,
  RaydiumPool,
  SolanaIntegrationError,
  SolanaParsingError,
  isValidSolanaAddress
} from '../common/types';
import {
  fetchAccountInfo,
  fetchMultipleAccountInfos,
  fetchProgramAccounts,
  verifyAccountDiscriminator,
  filterAccountsByDiscriminator,
  processAccountsBatch
} from '../common/accounts';
import {
  parseU64,
  parseU128,
  parseI64,
  findProgramAddress,
  getAssociatedTokenAccount,
  retryWithBackoff,
  handleRpcError
} from '../common/utils';
import { 
  RAYDIUM_CLMM_PROGRAM_ID,
  RAYDIUM_DISCRIMINATORS,
  RAYDIUM_SIZES,
  parsePoolStateAccount,
  parsePersonalPositionAccount,
  parseAmmConfigAccount
} from './clmm';
import { ProtocolType } from '../../../../types';

// ============================================================================
// RAYDIUM ACCOUNT DERIVATION
// ============================================================================

/**
 * Derive Raydium pool address from token mints and config
 */
export function derivePoolAddress(
  tokenMint0: string,
  tokenMint1: string,
  ammConfigIndex: number
): [string, number] {
  try {
    if (!isValidSolanaAddress(tokenMint0) || !isValidSolanaAddress(tokenMint1)) {
      throw new Error('Invalid token mint addresses');
    }

    // Ensure token0 < token1 (canonical order)
    let [mint0, mint1] = tokenMint0 < tokenMint1 
      ? [tokenMint0, tokenMint1] 
      : [tokenMint1, tokenMint0];

    const seeds = [
      Buffer.from('pool'),
      Buffer.from(ammConfigIndex.toString()),
      Buffer.from(mint0, 'hex'),
      Buffer.from(mint1, 'hex')
    ];

    return findProgramAddress(seeds, RAYDIUM_CLMM_PROGRAM_ID);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to derive pool address for ${tokenMint0}/${tokenMint1}`,
      ProtocolType.RAYDIUM,
      'ADDRESS_DERIVATION_ERROR',
      error as Error
    );
  }
}

/**
 * Derive position NFT mint address
 */
export function derivePositionNftMint(
  poolAddress: string,
  tickLower: number,
  tickUpper: number
): [string, number] {
  try {
    if (!isValidSolanaAddress(poolAddress)) {
      throw new Error('Invalid pool address');
    }

    const seeds = [
      Buffer.from('position'),
      Buffer.from(poolAddress, 'hex'),
      Buffer.from(tickLower.toString()),
      Buffer.from(tickUpper.toString())
    ];

    return findProgramAddress(seeds, RAYDIUM_CLMM_PROGRAM_ID);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to derive position NFT mint for pool ${poolAddress}`,
      ProtocolType.RAYDIUM,
      'ADDRESS_DERIVATION_ERROR',
      error as Error
    );
  }
}

/**
 * Derive personal position account address
 */
export function derivePersonalPositionAddress(
  nftMint: string,
  owner: string
): [string, number] {
  try {
    if (!isValidSolanaAddress(nftMint) || !isValidSolanaAddress(owner)) {
      throw new Error('Invalid NFT mint or owner address');
    }

    const seeds = [
      Buffer.from('personal_position'),
      Buffer.from(nftMint, 'hex'),
      Buffer.from(owner, 'hex')
    ];

    return findProgramAddress(seeds, RAYDIUM_CLMM_PROGRAM_ID);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to derive personal position address for NFT ${nftMint}`,
      ProtocolType.RAYDIUM,
      'ADDRESS_DERIVATION_ERROR',
      error as Error
    );
  }
}

/**
 * Derive tick array address
 */
export function deriveTickArrayAddress(
  poolAddress: string,
  startTickIndex: number
): [string, number] {
  try {
    if (!isValidSolanaAddress(poolAddress)) {
      throw new Error('Invalid pool address');
    }

    const seeds = [
      Buffer.from('tick_array'),
      Buffer.from(poolAddress, 'hex'),
      Buffer.from(startTickIndex.toString())
    ];

    return findProgramAddress(seeds, RAYDIUM_CLMM_PROGRAM_ID);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to derive tick array address for pool ${poolAddress}`,
      ProtocolType.RAYDIUM,
      'ADDRESS_DERIVATION_ERROR',
      error as Error
    );
  }
}

/**
 * Derive observation state address
 */
export function deriveObservationAddress(
  poolAddress: string
): [string, number] {
  try {
    if (!isValidSolanaAddress(poolAddress)) {
      throw new Error('Invalid pool address');
    }

    const seeds = [
      Buffer.from('observation'),
      Buffer.from(poolAddress, 'hex')
    ];

    return findProgramAddress(seeds, RAYDIUM_CLMM_PROGRAM_ID);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to derive observation address for pool ${poolAddress}`,
      ProtocolType.RAYDIUM,
      'ADDRESS_DERIVATION_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// BATCH ACCOUNT FETCHING
// ============================================================================

/**
 * Fetch all accounts related to a Raydium position
 */
export async function fetchPositionAccountBundle(
  context: SolanaContext,
  positionAddress: string
): Promise<{
  position: RaydiumPosition;
  pool: RaydiumPool;
  ammConfig?: any;
  nftAccount?: SolanaAccountInfo;
}> {
  try {
    // First fetch the position to get pool reference
    const positionAccount = await fetchAccountInfo(context, positionAddress);
    if (!positionAccount) {
      throw new Error(`Position account not found: ${positionAddress}`);
    }

    const position = parsePersonalPositionAccount(positionAccount.data as Buffer);
    position.accounts.position = positionAddress;

    // Fetch pool and related accounts in parallel
    const accountsToFetch = [
      position.pool, // Pool account
      // NFT mint account (if we had the address)
      // AMM config (would derive from pool)
    ];

    const accounts = await fetchMultipleAccountInfos(context, accountsToFetch);
    
    if (!accounts[0]) {
      throw new Error(`Pool account not found: ${position.pool}`);
    }

    const pool = parsePoolStateAccount(accounts[0].data as Buffer);
    pool.address = position.pool;

    // Fetch AMM config
    let ammConfig;
    try {
      const ammConfigAccount = await fetchAccountInfo(context, pool.ammConfig);
      if (ammConfigAccount) {
        ammConfig = parseAmmConfigAccount(ammConfigAccount.data as Buffer);
      }
    } catch (error) {
      console.warn('Failed to fetch AMM config:', error);
    }

    return {
      position,
      pool,
      ammConfig,
    };
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to fetch position account bundle for ${positionAddress}`,
      ProtocolType.RAYDIUM,
      'BUNDLE_FETCH_ERROR',
      error as Error
    );
  }
}

/**
 * Fetch multiple position bundles efficiently
 */
export async function fetchMultiplePositionBundles(
  context: SolanaContext,
  positionAddresses: string[]
): Promise<Array<{
  position: RaydiumPosition;
  pool: RaydiumPool;
  ammConfig?: any;
}>> {
  try {
    const bundles = await processAccountsBatch(
      positionAddresses.map(addr => ({ 
        pubkey: addr, 
        account: {} as SolanaAccountInfo 
      })),
      async ({ pubkey }) => {
        try {
          return await fetchPositionAccountBundle(context, pubkey);
        } catch (error) {
          console.warn(`Failed to fetch bundle for position ${pubkey}:`, error);
          return null;
        }
      },
      10 // Batch size
    );

    return bundles.filter(bundle => bundle !== null);
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to fetch multiple position bundles`,
      ProtocolType.RAYDIUM,
      'BATCH_FETCH_ERROR',
      error as Error
    );
  }
}

// ============================================================================
// ADVANCED ACCOUNT QUERIES
// ============================================================================

/**
 * Find all positions for a wallet across all pools
 */
export async function findWalletPositions(
  context: SolanaContext,
  walletAddress: string
): Promise<Array<{
  position: RaydiumPosition;
  pool: RaydiumPool;
  nftMint: string;
  nftAccount: string;
}>> {
  try {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new Error(`Invalid wallet address: ${walletAddress}`);
    }

    // Strategy: Find NFT tokens owned by the wallet, then check if they're Raydium position NFTs
    const tokenAccounts = await context.connection.getTokenAccountsByOwner(
      walletAddress,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { commitment: context.commitment }
    );

    const positions = [];

    for (const { pubkey, account } of tokenAccounts.value) {
      try {
        // Check if this token has amount = 1 (NFT characteristic)
        if (account.data.parsed?.info?.tokenAmount?.uiAmount === 1) {
          const nftMint = account.data.parsed.info.mint;
          
          // Try to derive personal position address
          const [personalPositionAddress] = derivePersonalPositionAddress(
            nftMint,
            walletAddress
          );

          // Check if this personal position account exists
          const positionAccount = await fetchAccountInfo(context, personalPositionAddress);
          if (positionAccount && verifyAccountDiscriminator(positionAccount, RAYDIUM_DISCRIMINATORS.POSITION_NFT)) {
            const position = parsePersonalPositionAccount(positionAccount.data as Buffer);
            position.accounts.position = personalPositionAddress;
            position.positionNftMint = nftMint;
            position.positionNftAccount = pubkey.toString();

            // Fetch pool data
            const poolAccount = await fetchAccountInfo(context, position.pool);
            if (poolAccount) {
              const pool = parsePoolStateAccount(poolAccount.data as Buffer);
              pool.address = position.pool;

              positions.push({
                position,
                pool,
                nftMint,
                nftAccount: pubkey.toString()
              });
            }
          }
        }
      } catch (error) {
        // Skip invalid tokens
        continue;
      }
    }

    return positions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to find wallet positions for ${walletAddress}`,
      ProtocolType.RAYDIUM,
      'WALLET_SCAN_ERROR',
      error as Error
    );
  }
}

/**
 * Get tick arrays for a pool to calculate accurate position values
 */
export async function getPoolTickArrays(
  context: SolanaContext,
  pool: RaydiumPool,
  tickLower: number,
  tickUpper: number
): Promise<Array<{
  address: string;
  startTickIndex: number;
  ticks: Array<{
    tick: number;
    liquidityNet: string;
    liquidityGross: string;
    feeGrowthOutside0: string;
    feeGrowthOutside1: string;
    rewardGrowthsOutside: string[];
  }>;
}>> {
  try {
    // Calculate which tick arrays we need
    const tickSpacing = pool.tickSpacing || 1;
    const tickArraySpacing = tickSpacing * 60; // Raydium uses 60 ticks per array
    
    const startIndex = Math.floor(tickLower / tickArraySpacing) * tickArraySpacing;
    const endIndex = Math.floor(tickUpper / tickArraySpacing) * tickArraySpacing;
    
    const tickArrayAddresses = [];
    for (let i = startIndex; i <= endIndex; i += tickArraySpacing) {
      const [tickArrayAddress] = deriveTickArrayAddress(pool.address, i);
      tickArrayAddresses.push({
        address: tickArrayAddress,
        startTickIndex: i
      });
    }

    // Fetch tick array accounts
    const accounts = await fetchMultipleAccountInfos(
      context,
      tickArrayAddresses.map(ta => ta.address)
    );

    const tickArrays = [];
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (account && account.data) {
        try {
          const tickArray = parseTickArrayAccount(account.data as Buffer);
          tickArrays.push({
            address: tickArrayAddresses[i].address,
            startTickIndex: tickArrayAddresses[i].startTickIndex,
            ticks: tickArray.ticks
          });
        } catch (error) {
          console.warn(`Failed to parse tick array at ${tickArrayAddresses[i].address}:`, error);
        }
      }
    }

    return tickArrays;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to get tick arrays for pool ${pool.address}`,
      ProtocolType.RAYDIUM,
      'TICK_ARRAY_ERROR',
      error as Error
    );
  }
}

/**
 * Parse tick array account data
 */
export function parseTickArrayAccount(data: Buffer): {
  discriminator: Buffer;
  startTickIndex: number;
  ticks: Array<{
    tick: number;
    liquidityNet: string;
    liquidityGross: string;
    feeGrowthOutside0: string;
    feeGrowthOutside1: string;
    rewardGrowthsOutside: string[];
  }>;
} {
  try {
    if (data.length < RAYDIUM_SIZES.TICK_ARRAY) {
      throw new Error(`Invalid tick array data size: ${data.length}`);
    }

    let offset = 8; // Skip discriminator
    const discriminator = data.slice(0, 8);

    const startTickIndex = data.readInt32LE(offset);
    offset += 4;

    const ticks = [];
    const tickCount = (data.length - offset) / RAYDIUM_SIZES.TICK;

    for (let i = 0; i < tickCount; i++) {
      const tickOffset = offset + (i * RAYDIUM_SIZES.TICK);
      
      const tick = data.readInt32LE(tickOffset);
      const liquidityNet = parseI64(data, tickOffset + 4).toString();
      const liquidityGross = parseU64(data, tickOffset + 12).toString();
      const feeGrowthOutside0 = parseU128(data, tickOffset + 20).toString();
      const feeGrowthOutside1 = parseU128(data, tickOffset + 36).toString();
      
      // Parse reward growths (up to 3 rewards)
      const rewardGrowthsOutside = [];
      for (let j = 0; j < 3; j++) {
        const rewardGrowth = parseU128(data, tickOffset + 52 + (j * 16)).toString();
        rewardGrowthsOutside.push(rewardGrowth);
      }

      ticks.push({
        tick,
        liquidityNet,
        liquidityGross,
        feeGrowthOutside0,
        feeGrowthOutside1,
        rewardGrowthsOutside
      });
    }

    return {
      discriminator,
      startTickIndex,
      ticks
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse tick array account',
      ProtocolType.RAYDIUM,
      data,
      error as Error
    );
  }
}

// ============================================================================
// ACCOUNT VALIDATION
// ============================================================================

/**
 * Validate Raydium position account structure
 */
export function validateRaydiumPositionAccount(
  account: SolanaAccountInfo
): boolean {
  try {
    // Check basic requirements
    if (!account.data || account.owner !== RAYDIUM_CLMM_PROGRAM_ID) {
      return false;
    }

    const data = Buffer.isBuffer(account.data)
      ? account.data
      : Buffer.from(account.data as string, 'base64');

    // Check data size
    if (data.length !== RAYDIUM_SIZES.POSITION_NFT) {
      return false;
    }

    // Check discriminator
    return verifyAccountDiscriminator(account, RAYDIUM_DISCRIMINATORS.POSITION_NFT);
  } catch {
    return false;
  }
}

/**
 * Validate Raydium pool account structure
 */
export function validateRaydiumPoolAccount(
  account: SolanaAccountInfo
): boolean {
  try {
    // Check basic requirements
    if (!account.data || account.owner !== RAYDIUM_CLMM_PROGRAM_ID) {
      return false;
    }

    const data = Buffer.isBuffer(account.data)
      ? account.data
      : Buffer.from(account.data as string, 'base64');

    // Check data size
    if (data.length !== RAYDIUM_SIZES.POOL_STATE) {
      return false;
    }

    // Check discriminator
    return verifyAccountDiscriminator(account, RAYDIUM_DISCRIMINATORS.POOL_STATE);
  } catch {
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Address derivation
  derivePoolAddress,
  derivePositionNftMint,
  derivePersonalPositionAddress,
  deriveTickArrayAddress,
  deriveObservationAddress,
  
  // Batch fetching
  fetchPositionAccountBundle,
  fetchMultiplePositionBundles,
  
  // Advanced queries
  findWalletPositions,
  getPoolTickArrays,
  
  // Parsing
  parseTickArrayAccount,
  
  // Validation
  validateRaydiumPositionAccount,
  validateRaydiumPoolAccount,
};