import { ERROR_CODES } from '@/types/api';
import { ChainType, CHAIN_REGEX } from '@/types';

// Validation utility functions
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
    public code: string = ERROR_CODES.MISSING_REQUIRED_FIELD,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Wallet address validation
export function validateWalletAddress(address: string): { isValid: boolean; chain?: ChainType; error?: string } {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Wallet address is required and must be a string',
    };
  }

  const trimmedAddress = address.trim();

  // Check Ethereum address
  if (CHAIN_REGEX.ethereum.test(trimmedAddress)) {
    return {
      isValid: true,
      chain: 'ethereum',
    };
  }

  // Check Solana address
  if (CHAIN_REGEX.solana.test(trimmedAddress)) {
    return {
      isValid: true,
      chain: 'solana',
    };
  }

  return {
    isValid: false,
    error: 'Invalid wallet address format. Must be a valid Ethereum or Solana address.',
  };
}

// Chain validation
export function validateChain(chain: string): boolean {
  const supportedChains = ['ethereum', 'solana', 'arbitrum', 'polygon', 'base'];
  return supportedChains.includes(chain.toLowerCase());
}

// Protocol validation
export function validateProtocols(protocols: string[]): { isValid: boolean; error?: string; invalidProtocols?: string[] } {
  if (!Array.isArray(protocols)) {
    return {
      isValid: false,
      error: 'Protocols must be an array',
    };
  }

  const supportedProtocols = [
    // Ethereum
    'uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer',
    // Solana
    'meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter',
    // L2
    'uniswap-v3-arbitrum', 'uniswap-v3-polygon', 'uniswap-v3-base'
  ];

  const invalidProtocols = protocols.filter(p => !supportedProtocols.includes(p));

  if (invalidProtocols.length > 0) {
    return {
      isValid: false,
      error: `Unsupported protocols: ${invalidProtocols.join(', ')}`,
      invalidProtocols,
    };
  }

  return { isValid: true };
}

// Timeframe validation
export function validateTimeframe(timeframe: string): boolean {
  const validTimeframes = ['1h', '24h', '7d', '30d', '90d', '1y'];
  return validTimeframes.includes(timeframe);
}

// Pagination validation
export function validatePagination(page?: string | number, limit?: string | number): {
  page: number;
  limit: number;
  error?: string;
} {
  let parsedPage = 1;
  let parsedLimit = 50;

  // Validate page
  if (page !== undefined) {
    parsedPage = typeof page === 'string' ? parseInt(page, 10) : page;
    if (isNaN(parsedPage) || parsedPage < 1) {
      return {
        page: 1,
        limit: 50,
        error: 'Page must be a positive integer',
      };
    }
  }

  // Validate limit
  if (limit !== undefined) {
    parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return {
        page: parsedPage,
        limit: 50,
        error: 'Limit must be between 1 and 100',
      };
    }
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
}

// Request body validation schemas
export interface ScanRequestSchema {
  wallet: string;
  chains?: string[];
  protocols?: string[];
  includeHistorical?: boolean;
  refresh?: boolean;
}

export function validateScanRequest(body: any): {
  isValid: boolean;
  data?: ScanRequestSchema;
  errors?: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // Validate wallet
  if (!body.wallet) {
    errors.push(new ValidationError('wallet', 'Wallet address is required', ERROR_CODES.MISSING_REQUIRED_FIELD));
  } else {
    const walletValidation = validateWalletAddress(body.wallet);
    if (!walletValidation.isValid) {
      errors.push(new ValidationError('wallet', walletValidation.error!, ERROR_CODES.INVALID_WALLET_ADDRESS, body.wallet));
    }
  }

  // Validate chains (optional)
  if (body.chains !== undefined) {
    if (!Array.isArray(body.chains)) {
      errors.push(new ValidationError('chains', 'Chains must be an array', ERROR_CODES.UNSUPPORTED_CHAIN));
    } else {
      const invalidChains = body.chains.filter((chain: any) => !validateChain(chain));
      if (invalidChains.length > 0) {
        errors.push(new ValidationError('chains', `Invalid chains: ${invalidChains.join(', ')}`, ERROR_CODES.UNSUPPORTED_CHAIN, invalidChains));
      }
    }
  }

  // Validate protocols (optional)
  if (body.protocols !== undefined) {
    const protocolValidation = validateProtocols(body.protocols);
    if (!protocolValidation.isValid) {
      errors.push(new ValidationError('protocols', protocolValidation.error!, ERROR_CODES.INVALID_PROTOCOL, protocolValidation.invalidProtocols));
    }
  }

  // Validate boolean fields
  if (body.includeHistorical !== undefined && typeof body.includeHistorical !== 'boolean') {
    errors.push(new ValidationError('includeHistorical', 'includeHistorical must be a boolean'));
  }

  if (body.refresh !== undefined && typeof body.refresh !== 'boolean') {
    errors.push(new ValidationError('refresh', 'refresh must be a boolean'));
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      wallet: body.wallet,
      chains: body.chains,
      protocols: body.protocols,
      includeHistorical: body.includeHistorical || false,
      refresh: body.refresh || false,
    },
  };
}

// Analytics request validation
export interface AnalyticsRequestSchema {
  wallets?: string[];
  timeframe?: string;
  includeComparisons?: boolean;
  includeForecasting?: boolean;
}

export function validateAnalyticsRequest(body: any): {
  isValid: boolean;
  data?: AnalyticsRequestSchema;
  errors?: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // Validate wallets (optional)
  if (body.wallets !== undefined) {
    if (!Array.isArray(body.wallets)) {
      errors.push(new ValidationError('wallets', 'Wallets must be an array'));
    } else {
      for (let i = 0; i < body.wallets.length; i++) {
        const walletValidation = validateWalletAddress(body.wallets[i]);
        if (!walletValidation.isValid) {
          errors.push(new ValidationError(`wallets[${i}]`, walletValidation.error!, ERROR_CODES.INVALID_WALLET_ADDRESS, body.wallets[i]));
        }
      }

      if (body.wallets.length > 10) {
        errors.push(new ValidationError('wallets', 'Maximum 10 wallets allowed per request'));
      }
    }
  }

  // Validate timeframe (optional)
  if (body.timeframe !== undefined) {
    if (!validateTimeframe(body.timeframe)) {
      errors.push(new ValidationError('timeframe', 'Invalid timeframe', ERROR_CODES.INVALID_TIMEFRAME, body.timeframe));
    }
  }

  // Validate boolean fields
  if (body.includeComparisons !== undefined && typeof body.includeComparisons !== 'boolean') {
    errors.push(new ValidationError('includeComparisons', 'includeComparisons must be a boolean'));
  }

  if (body.includeForecasting !== undefined && typeof body.includeForecasting !== 'boolean') {
    errors.push(new ValidationError('includeForecasting', 'includeForecasting must be a boolean'));
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      wallets: body.wallets,
      timeframe: body.timeframe || '30d',
      includeComparisons: body.includeComparisons || false,
      includeForecasting: body.includeForecasting || false,
    },
  };
}

// Generic validation helper
export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: Array<keyof T>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(new ValidationError(
        field as string,
        `${String(field)} is required`,
        ERROR_CODES.MISSING_REQUIRED_FIELD
      ));
    }
  }

  return errors;
}

// URL parameter validation
export function validateUrlParam(param: string | undefined, paramName: string, required: boolean = true): {
  isValid: boolean;
  value?: string;
  error?: ValidationError;
} {
  if (!param) {
    if (required) {
      return {
        isValid: false,
        error: new ValidationError(paramName, `${paramName} parameter is required`),
      };
    }
    return { isValid: true };
  }

  const trimmedParam = param.trim();
  if (!trimmedParam) {
    return {
      isValid: false,
      error: new ValidationError(paramName, `${paramName} cannot be empty`),
    };
  }

  return {
    isValid: true,
    value: trimmedParam,
  };
}