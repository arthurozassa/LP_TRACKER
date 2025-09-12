/**
 * WebSocket Authentication System
 * Handles authentication for WebSocket connections
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pino from 'pino';

// ============================================================================
// AUTHENTICATION INTERFACES
// ============================================================================

export interface AuthConfig {
  required: boolean;
  tokenSecret: string;
  apiKeyValidation: boolean;
}

export interface AuthRequest {
  token?: string;
  apiKey?: string;
  walletAddress?: string;
  signature?: string;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  walletAddress?: string;
  permissions?: string[];
  authMethod?: 'token' | 'api_key' | 'wallet_signature' | 'anonymous';
  error?: string;
  code?: string;
}

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  isActive: boolean;
  lastUsed?: Date;
}

export interface JwtPayload {
  userId: string;
  walletAddress?: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

// ============================================================================
// WEBSOCKET AUTHENTICATION CLASS
// ============================================================================

export class WebSocketAuth {
  private config: AuthConfig;
  private logger: pino.Logger;
  private apiKeys: Map<string, ApiKeyInfo>;
  private walletNonces: Map<string, { nonce: string; expires: Date }>;

  constructor(config?: AuthConfig, logger?: pino.Logger) {
    this.config = {
      required: process.env.NODE_ENV === 'production',
      tokenSecret: process.env.JWT_SECRET || 'development-secret',
      apiKeyValidation: true,
      ...config,
    };

    this.logger = logger || pino({ name: 'websocket-auth' });
    this.apiKeys = new Map();
    this.walletNonces = new Map();

    this.initializeApiKeys();
    this.startNonceCleanup();
  }

  // ============================================================================
  // PUBLIC METHODS - AUTHENTICATION
  // ============================================================================

  public async authenticate(authRequest: AuthRequest): Promise<AuthResult> {
    try {
      // If authentication is not required, allow anonymous access
      if (!this.config.required) {
        return {
          success: true,
          authMethod: 'anonymous',
          permissions: ['read'],
        };
      }

      // Try different authentication methods in order of preference
      if (authRequest.token) {
        return await this.authenticateWithToken(authRequest.token);
      }

      if (authRequest.apiKey) {
        return await this.authenticateWithApiKey(authRequest.apiKey);
      }

      if (authRequest.walletAddress && authRequest.signature) {
        return await this.authenticateWithWalletSignature(
          authRequest.walletAddress,
          authRequest.signature
        );
      }

      // No valid authentication method provided
      return {
        success: false,
        error: 'No valid authentication method provided',
        code: 'no_auth_method',
      };

    } catch (error) {
      this.logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }, 'Authentication error');

      return {
        success: false,
        error: 'Authentication service error',
        code: 'auth_service_error',
      };
    }
  }

  // ============================================================================
  // PUBLIC METHODS - TOKEN MANAGEMENT
  // ============================================================================

  public generateToken(userId: string, walletAddress?: string, permissions: string[] = []): string {
    const payload: JwtPayload = {
      userId,
      walletAddress,
      permissions,
    };

    return jwt.sign(payload, this.config.tokenSecret, {
      expiresIn: '24h',
      issuer: 'lp-tracker',
      audience: 'websocket-client',
    });
  }

  public generateApiKey(userId: string, name: string, permissions: string[] = []): ApiKeyInfo {
    const apiKey = this.generateSecureKey();
    const keyInfo: ApiKeyInfo = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      permissions,
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerDay: 10000,
      },
      isActive: true,
    };

    this.apiKeys.set(apiKey, keyInfo);

    this.logger.info({
      keyId: keyInfo.id,
      userId,
      name,
      permissions,
    }, 'API key generated');

    return keyInfo;
  }

  public revokeApiKey(apiKey: string): boolean {
    const keyInfo = this.apiKeys.get(apiKey);
    if (keyInfo) {
      this.apiKeys.delete(apiKey);
      
      this.logger.info({
        keyId: keyInfo.id,
        userId: keyInfo.userId,
        name: keyInfo.name,
      }, 'API key revoked');
      
      return true;
    }
    return false;
  }

  // ============================================================================
  // PUBLIC METHODS - WALLET SIGNATURE
  // ============================================================================

  public generateWalletNonce(walletAddress: string): string {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    this.walletNonces.set(walletAddress.toLowerCase(), { nonce, expires });

    this.logger.debug({
      walletAddress,
      expiresAt: expires,
    }, 'Wallet nonce generated');

    return nonce;
  }

  public verifyWalletSignature(walletAddress: string, signature: string, nonce?: string): boolean {
    try {
      const storedNonce = this.walletNonces.get(walletAddress.toLowerCase());
      
      // Use provided nonce or stored nonce
      const nonceToVerify = nonce || storedNonce?.nonce;
      if (!nonceToVerify) {
        return false;
      }

      // Check if nonce has expired
      if (storedNonce && new Date() > storedNonce.expires) {
        this.walletNonces.delete(walletAddress.toLowerCase());
        return false;
      }

      // Create message to verify
      const message = this.createSignatureMessage(walletAddress, nonceToVerify);
      
      // Verify signature using Web3/crypto utilities
      const isValid = this.verifyEthereumSignature(message, signature, walletAddress) ||
                      this.verifySolanaSignature(message, signature, walletAddress);

      if (isValid && storedNonce) {
        // Remove used nonce
        this.walletNonces.delete(walletAddress.toLowerCase());
      }

      return isValid;

    } catch (error) {
      this.logger.error({
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Signature verification error');
      
      return false;
    }
  }

  // ============================================================================
  // PUBLIC METHODS - VALIDATION
  // ============================================================================

  public validateToken(token: string): { valid: boolean; payload?: JwtPayload; error?: string } {
    try {
      const payload = jwt.verify(token, this.config.tokenSecret) as JwtPayload;
      return { valid: true, payload };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      } else {
        return { valid: false, error: 'Token validation error' };
      }
    }
  }

  public hasPermission(permissions: string[], requiredPermission: string): boolean {
    if (permissions.includes('admin')) return true;
    if (permissions.includes(requiredPermission)) return true;
    
    // Check for wildcard permissions
    const permissionParts = requiredPermission.split(':');
    for (let i = permissionParts.length - 1; i >= 0; i--) {
      const wildcardPermission = permissionParts.slice(0, i).join(':') + ':*';
      if (permissions.includes(wildcardPermission)) return true;
    }
    
    return false;
  }

  // ============================================================================
  // PRIVATE METHODS - AUTHENTICATION
  // ============================================================================

  private async authenticateWithToken(token: string): Promise<AuthResult> {
    const validation = this.validateToken(token);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid token',
        code: 'invalid_token',
      };
    }

    const payload = validation.payload!;
    
    return {
      success: true,
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      permissions: payload.permissions,
      authMethod: 'token',
    };
  }

  private async authenticateWithApiKey(apiKey: string): Promise<AuthResult> {
    if (!this.config.apiKeyValidation) {
      return {
        success: false,
        error: 'API key authentication disabled',
        code: 'api_key_disabled',
      };
    }

    const keyInfo = this.apiKeys.get(apiKey);
    
    if (!keyInfo) {
      return {
        success: false,
        error: 'Invalid API key',
        code: 'invalid_api_key',
      };
    }

    if (!keyInfo.isActive) {
      return {
        success: false,
        error: 'API key is inactive',
        code: 'inactive_api_key',
      };
    }

    // Update last used timestamp
    keyInfo.lastUsed = new Date();

    return {
      success: true,
      userId: keyInfo.userId,
      permissions: keyInfo.permissions,
      authMethod: 'api_key',
    };
  }

  private async authenticateWithWalletSignature(
    walletAddress: string,
    signature: string
  ): Promise<AuthResult> {
    const isValid = this.verifyWalletSignature(walletAddress, signature);
    
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid wallet signature',
        code: 'invalid_signature',
      };
    }

    // Generate a user ID based on wallet address
    const userId = `wallet_${walletAddress.toLowerCase()}`;

    return {
      success: true,
      userId,
      walletAddress,
      permissions: ['positions:read', 'portfolio:read'],
      authMethod: 'wallet_signature',
    };
  }

  // ============================================================================
  // PRIVATE METHODS - SIGNATURE VERIFICATION
  // ============================================================================

  private createSignatureMessage(walletAddress: string, nonce: string): string {
    return `LP Tracker Authentication\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  }

  private verifyEthereumSignature(message: string, signature: string, walletAddress: string): boolean {
    try {
      // This would use ethers.js or web3.js to verify the signature
      // For now, we'll use a simplified version
      
      // In a real implementation:
      // const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      // return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
      
      // Placeholder implementation
      return signature.length === 132 && signature.startsWith('0x'); // Basic format check
      
    } catch (error) {
      this.logger.error({
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Ethereum signature verification error');
      
      return false;
    }
  }

  private verifySolanaSignature(message: string, signature: string, walletAddress: string): boolean {
    try {
      // This would use @solana/web3.js to verify the signature
      // For now, we'll use a simplified version
      
      // In a real implementation:
      // const publicKey = new PublicKey(walletAddress);
      // const messageBytes = new TextEncoder().encode(message);
      // const signatureBytes = bs58.decode(signature);
      // return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
      
      // Placeholder implementation
      return signature.length > 50 && walletAddress.length >= 32; // Basic format check
      
    } catch (error) {
      this.logger.error({
        walletAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Solana signature verification error');
      
      return false;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - UTILITIES
  // ============================================================================

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private initializeApiKeys(): void {
    // Initialize with some demo API keys in development
    if (process.env.NODE_ENV !== 'production') {
      const demoKey = this.generateSecureKey();
      this.apiKeys.set(demoKey, {
        id: 'demo_key_1',
        userId: 'demo_user',
        name: 'Demo API Key',
        permissions: ['positions:read', 'portfolio:read', 'analytics:read'],
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerDay: 10000,
        },
        isActive: true,
      });

      this.logger.info({
        apiKey: demoKey,
        permissions: ['positions:read', 'portfolio:read', 'analytics:read'],
      }, 'Demo API key created for development');
    }
  }

  private startNonceCleanup(): void {
    // Clean up expired nonces every minute
    setInterval(() => {
      const now = new Date();
      const expiredAddresses: string[] = [];

      for (const [address, nonceInfo] of this.walletNonces.entries()) {
        if (now > nonceInfo.expires) {
          expiredAddresses.push(address);
        }
      }

      for (const address of expiredAddresses) {
        this.walletNonces.delete(address);
      }

      if (expiredAddresses.length > 0) {
        this.logger.debug({
          expiredNonces: expiredAddresses.length,
        }, 'Cleaned up expired wallet nonces');
      }
    }, 60000); // 1 minute
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function generateWalletAuthMessage(walletAddress: string, nonce: string): string {
  return `LP Tracker Authentication\n\nPlease sign this message to authenticate your wallet.\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
}

export function isEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function validateWalletAddress(address: string): { valid: boolean; chain?: 'ethereum' | 'solana'; error?: string } {
  if (isEthereumAddress(address)) {
    return { valid: true, chain: 'ethereum' };
  }
  
  if (isSolanaAddress(address)) {
    return { valid: true, chain: 'solana' };
  }
  
  return { valid: false, error: 'Invalid wallet address format' };
}