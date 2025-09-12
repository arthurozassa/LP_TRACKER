/**
 * Solana account parsing utilities
 * Common account structures and parsing logic used across protocols
 */

import { 
  SolanaAccountInfo,
  SolanaTokenAccount,
  SolanaPosition,
  SolanaPool,
  SolanaIntegrationError,
  SolanaAccountError,
  SolanaParsingError,
  SolanaContext,
  SOLANA_PROGRAMS,
  isValidSolanaAddress
} from './types';
import { 
  parseAccountData,
  parseTokenAccountData,
  parseU64,
  parseU128,
  parseI64,
  handleRpcError,
  handleAccountNotFound,
  retryWithBackoff,
  validateAccountData
} from './utils';
import { ProtocolType } from '../../../../types';

// ============================================================================
// ACCOUNT FETCHING
// ============================================================================

/**
 * Fetch single account info
 */
export async function fetchAccountInfo(
  context: SolanaContext,
  address: string
): Promise<SolanaAccountInfo | null> {
  try {
    if (!isValidSolanaAddress(address)) {
      throw new SolanaIntegrationError(
        `Invalid address: ${address}`,
        'meteora-dlmm',
        'INVALID_ADDRESS'
      );
    }

    return await retryWithBackoff(async () => {
      const response = await context.connection.getAccountInfo(
        address,
        { commitment: context.commitment }
      );
      
      if (!response) return null;
      
      return {
        executable: response.executable,
        owner: response.owner.toString(),
        lamports: response.lamports,
        data: response.data,
        rentEpoch: response.rentEpoch
      };
    }, 'Logger message');
  } catch (error) {
    handleRpcError(error, `fetchAccountInfo(${address})`);
  }
}

/**
 * Fetch multiple account infos
 */
export async function fetchMultipleAccountInfos(
  context: SolanaContext,
  addresses: string[]
): Promise<(SolanaAccountInfo | null)[]> {
  try {
    // Validate all addresses
    for (const address of addresses) {
      if (!isValidSolanaAddress(address)) {
        throw new SolanaIntegrationError(
          `Invalid address: ${address}`,
          'meteora-dlmm',
          'INVALID_ADDRESS'
        );
      }
    }

    // Batch into chunks of 100 (Solana RPC limit)
    const BATCH_SIZE = 100;
    const results: (SolanaAccountInfo | null)[] = [];
    
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const chunk = addresses.slice(i, i + BATCH_SIZE);
      
      const chunkResults = await retryWithBackoff(async () => {
        const response = await context.connection.getMultipleAccountsInfo(
          chunk,
          { commitment: context.commitment }
        );
        
        return response.map((account: any) => {
          if (!account) return null;
          
          return {
            executable: account.executable,
            owner: account.owner.toString(),
            lamports: account.lamports,
            data: account.data,
            rentEpoch: account.rentEpoch
          };
        }, 'Logger message');
      }, 'Logger message');
      
      results.push(...chunkResults);
    }
    
    return results;
  } catch (error) {
    handleRpcError(error, `fetchMultipleAccountInfos(${addresses.length} accounts)`);
  }
}

/**
 * Fetch program accounts with filters
 */
export async function fetchProgramAccounts(
  context: SolanaContext,
  programId: string,
  filters?: Array<{
    memcmp?: { offset: number; bytes: string };
    dataSize?: number;
  }>
): Promise<Array<{ pubkey: string; account: SolanaAccountInfo }>> {
  try {
    if (!isValidSolanaAddress(programId)) {
      throw new SolanaIntegrationError(
        `Invalid program ID: ${programId}`,
        'meteora-dlmm',
        'INVALID_PROGRAM_ID'
      );
    }

    return await retryWithBackoff(async () => {
      const config: any = {
        commitment: context.commitment,
        encoding: 'base64',
      };
      
      if (filters && filters.length > 0) {
        config.filters = filters;
      }
      
      const response = await context.connection.getProgramAccounts(
        programId,
        config
      );
      
      return response.map(({ pubkey, account }: any) => ({
        pubkey: pubkey.toString(),
        account: {
          executable: account.executable,
          owner: account.owner.toString(),
          lamports: account.lamports,
          data: account.data,
          rentEpoch: account.rentEpoch
        }
      }));
    }, 'Logger message');
  } catch (error) {
    handleRpcError(error, `fetchProgramAccounts(${programId})`);
  }
}

/**
 * Fetch token accounts by owner
 */
export async function fetchTokenAccountsByOwner(
  context: SolanaContext,
  owner: string,
  mint?: string
): Promise<SolanaTokenAccount[]> {
  try {
    if (!isValidSolanaAddress(owner)) {
      throw new SolanaIntegrationError(
        `Invalid owner address: ${owner}`,
        'meteora-dlmm',
        'INVALID_ADDRESS'
      );
    }

    if (mint && !isValidSolanaAddress(mint)) {
      throw new SolanaIntegrationError(
        `Invalid mint address: ${mint}`,
        'meteora-dlmm',
        'INVALID_ADDRESS'
      );
    }

    return await retryWithBackoff(async () => {
      const filter = mint 
        ? { mint } 
        : { programId: SOLANA_PROGRAMS.TOKEN };
      
      const response = await context.connection.getTokenAccountsByOwner(
        owner,
        filter,
        { 
          commitment: context.commitment,
          encoding: 'jsonParsed'
        }
      );
      
      return response.value.map(({ pubkey, account }: any) => ({
        pubkey: pubkey.toString(),
        account: account.data.parsed.info
      }));
    }, 'Logger message');
  } catch (error) {
    handleRpcError(error, `fetchTokenAccountsByOwner(${owner})`);
  }
}

// ============================================================================
// ACCOUNT PARSING
// ============================================================================

/**
 * Parse position account data (generic)
 */
export function parsePositionAccount(
  data: Buffer,
  protocol: ProtocolType
): any {
  try {
    if (!validateAccountData(data)) {
      throw new SolanaParsingError(
        'Invalid account data',
        protocol,
        data
      );
    }

    // This is a generic parser - specific protocols will override
    const discriminator = data.slice(0, 8);
    const positionData = data.slice(8);
    
    return {
      discriminator,
      data: positionData
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse position account',
      protocol,
      data,
      error as Error
    );
  }
}

/**
 * Parse pool account data (generic)
 */
export function parsePoolAccount(
  data: Buffer,
  protocol: ProtocolType
): any {
  try {
    if (!validateAccountData(data)) {
      throw new SolanaParsingError(
        'Invalid account data',
        protocol,
        data
      );
    }

    // Generic pool parsing
    const discriminator = data.slice(0, 8);
    const poolData = data.slice(8);
    
    return {
      discriminator,
      data: poolData
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse pool account',
      protocol,
      data,
      error as Error
    );
  }
}

// ============================================================================
// ACCOUNT SCANNING
// ============================================================================

/**
 * Scan for all position accounts owned by a wallet
 */
export async function scanPositionAccounts(
  context: SolanaContext,
  walletAddress: string,
  programIds: string[]
): Promise<Array<{ pubkey: string; account: SolanaAccountInfo; programId: string }>> {
  try {
    const allPositions: Array<{ pubkey: string; account: SolanaAccountInfo; programId: string }> = [];
    
    // Scan each program
    for (const programId of programIds) {
      try {
        // Filter for accounts owned by the wallet
        const filters = [{
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: walletAddress
          }
        }];
        
        const accounts = await fetchProgramAccounts(context, programId, filters);
        
        for (const { pubkey, account } of accounts) {
          allPositions.push({
            pubkey,
            account,
            programId
          }, 'Logger message');
        }
      } catch (error) {
        console.warn(`Failed to scan program ${programId}:`, error);
        // Continue with other programs
      }
    }
    
    return allPositions;
  } catch (error) {
    throw new SolanaIntegrationError(
      `Failed to scan position accounts for wallet ${walletAddress}`,
      'meteora-dlmm',
      'SCAN_FAILED',
      error as Error
    );
  }
}

/**
 * Scan for all pool accounts for given protocols
 */
export async function scanPoolAccounts(
  context: SolanaContext,
  programIds: string[]
): Promise<Array<{ pubkey: string; account: SolanaAccountInfo; programId: string }>> {
  try {
    const allPools: Array<{ pubkey: string; account: SolanaAccountInfo; programId: string }> = [];
    
    for (const programId of programIds) {
      try {
        // Get all pool accounts (no filters, but might be a lot of data)
        const accounts = await fetchProgramAccounts(context, programId);
        
        for (const { pubkey, account } of accounts) {
          // Basic validation that this looks like a pool
          if (account.data && (account.data as Buffer).length > 100) {
            allPools.push({
              pubkey,
              account,
              programId
            }, 'Logger message');
          }
        }
      } catch (error) {
        console.warn(`Failed to scan pools for program ${programId}:`, error);
        // Continue with other programs
      }
    }
    
    return allPools;
  } catch (error) {
    throw new SolanaIntegrationError(
      'Failed to scan pool accounts',
      'meteora-dlmm',
      'SCAN_FAILED',
      error as Error
    );
  }
}

// ============================================================================
// ACCOUNT VERIFICATION
// ============================================================================

/**
 * Verify account belongs to expected program
 */
export function verifyAccountOwner(
  account: SolanaAccountInfo,
  expectedOwner: string
): boolean {
  return account.owner === expectedOwner;
}

/**
 * Verify account has minimum required data size
 */
export function verifyAccountDataSize(
  account: SolanaAccountInfo,
  minSize: number
): boolean {
  if (!account.data) return false;
  return Buffer.isBuffer(account.data) 
    ? account.data.length >= minSize
    : Buffer.from(account.data as string, 'base64').length >= minSize;
}

/**
 * Verify account discriminator matches expected
 */
export function verifyAccountDiscriminator(
  account: SolanaAccountInfo,
  expectedDiscriminator: Buffer
): boolean {
  if (!account.data) return false;
  
  const data = Buffer.isBuffer(account.data)
    ? account.data
    : Buffer.from(account.data as string, 'base64');
    
  if (data.length < 8) return false;
  
  const discriminator = data.slice(0, 8);
  return discriminator.equals(expectedDiscriminator);
}

// ============================================================================
// ACCOUNT FILTERING
// ============================================================================

/**
 * Filter accounts by data size
 */
export function filterAccountsBySize(
  accounts: Array<{ pubkey: string; account: SolanaAccountInfo }>,
  minSize: number,
  maxSize?: number
): Array<{ pubkey: string; account: SolanaAccountInfo }> {
  return accounts.filter(({ account }) => {
    if (!account.data) return false;
    
    const size = Buffer.isBuffer(account.data)
      ? account.data.length
      : Buffer.from(account.data as string, 'base64').length;
      
    return size >= minSize && (maxSize === undefined || size <= maxSize);
  });
}

/**
 * Filter accounts by discriminator
 */
export function filterAccountsByDiscriminator(
  accounts: Array<{ pubkey: string; account: SolanaAccountInfo }>,
  discriminator: Buffer
): Array<{ pubkey: string; account: SolanaAccountInfo }> {
  return accounts.filter(({ account }) => 
    verifyAccountDiscriminator(account, discriminator)
  );
}

/**
 * Filter accounts by owner program
 */
export function filterAccountsByOwner(
  accounts: Array<{ pubkey: string; account: SolanaAccountInfo }>,
  owner: string
): Array<{ pubkey: string; account: SolanaAccountInfo }> {
  return accounts.filter(({ account }) => account.owner === owner);
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process accounts in batches to avoid memory issues
 */
export async function processAccountsBatch<T>(
  accounts: Array<{ pubkey: string; account: SolanaAccountInfo }>,
  processor: (account: { pubkey: string; account: SolanaAccountInfo }) => Promise<T>,
  batchSize: number = 50
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const batchPromises = batch.map(processor);
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.warn('Failed to process account:', result.reason);
      }
    }
  }
  
  return results;
}

// ============================================================================
// CACHING
// ============================================================================

/**
 * Simple in-memory cache for account data
 */
class AccountCache {
  private cache = new Map<string, { data: SolanaAccountInfo; timestamp: number }>();
  private ttl = 30000; // 30 seconds

  set(address: string, data: SolanaAccountInfo): void {
    this.cache.set(address, {
      data,
      timestamp: Date.now()
    }, 'Logger message');
  }

  get(address: string): SolanaAccountInfo | null {
    const cached = this.cache.get(address);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(address);
      return null;
    }
    
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const accountCache = new AccountCache();

/**
 * Fetch account with caching
 */
export async function fetchAccountInfoCached(
  context: SolanaContext,
  address: string
): Promise<SolanaAccountInfo | null> {
  const cached = accountCache.get(address);
  if (cached) return cached;
  
  const account = await fetchAccountInfo(context, address);
  if (account) {
    accountCache.set(address, account);
  }
  
  return account;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Fetching
  fetchAccountInfo,
  fetchMultipleAccountInfos,
  fetchProgramAccounts,
  fetchTokenAccountsByOwner,
  
  // Parsing
  parsePositionAccount,
  parsePoolAccount,
  
  // Scanning
  scanPositionAccounts,
  scanPoolAccounts,
  
  // Verification
  verifyAccountOwner,
  verifyAccountDataSize,
  verifyAccountDiscriminator,
  
  // Filtering
  filterAccountsBySize,
  filterAccountsByDiscriminator,
  filterAccountsByOwner,
  
  // Batch processing
  processAccountsBatch,
  
  // Caching
  fetchAccountInfoCached,
  accountCache,
};