import { ProtocolConfig, Chain } from './types';
import { ethereumProtocols, l2Protocols } from './ethereum';
import { solanaProtocols } from './solana';

// Combined protocol registry
export const protocolRegistry: Record<string, ProtocolConfig> = {
  ...ethereumProtocols,
  ...l2Protocols,
  ...solanaProtocols,
};

// Helper functions for protocol management
export class ProtocolRegistry {
  /**
   * Get all protocols for a specific chain
   */
  static getProtocolsByChain(chain: Chain): ProtocolConfig[] {
    return Object.values(protocolRegistry).filter(protocol => protocol.chain === chain);
  }

  /**
   * Get protocol configuration by ID
   */
  static getProtocolById(protocolId: string): ProtocolConfig | undefined {
    return protocolRegistry[protocolId];
  }

  /**
   * Get all active protocols
   */
  static getActiveProtocols(): ProtocolConfig[] {
    return Object.values(protocolRegistry).filter(protocol => protocol.isActive);
  }

  /**
   * Get protocols that support specific features
   */
  static getProtocolsByFeatures(features: {
    v2?: boolean;
    v3?: boolean;
    concentrated?: boolean;
    stable?: boolean;
  }): ProtocolConfig[] {
    return Object.values(protocolRegistry).filter(protocol => {
      if (features.v2 && !protocol.supportedFeatures.v2) return false;
      if (features.v3 && !protocol.supportedFeatures.v3) return false;
      if (features.concentrated && !protocol.supportedFeatures.concentrated) return false;
      if (features.stable && !protocol.supportedFeatures.stable) return false;
      return true;
    });
  }

  /**
   * Get protocol display name with emoji
   */
  static getDisplayName(protocolId: string): string {
    const protocol = protocolRegistry[protocolId];
    return protocol ? `${protocol.emoji} ${protocol.name}` : protocolId;
  }

  /**
   * Get manage URL for a specific position
   */
  static getManageUrl(protocolId: string, positionId?: string): string | undefined {
    const protocol = protocolRegistry[protocolId];
    if (!protocol?.manageUrl) return undefined;

    if (positionId) {
      // Append position ID for protocols that support direct position management
      if (protocol.chain === 'solana') {
        return `${protocol.manageUrl}/${positionId}`;
      } else {
        return `${protocol.manageUrl}/${positionId}`;
      }
    }

    return protocol.manageUrl;
  }

  /**
   * Get all supported chains
   */
  static getSupportedChains(): Chain[] {
    const chains = new Set<Chain>();
    Object.values(protocolRegistry).forEach(protocol => {
      chains.add(protocol.chain);
    });
    return Array.from(chains);
  }

  /**
   * Get protocol statistics
   */
  static getProtocolStats() {
    const total = Object.keys(protocolRegistry).length;
    const active = this.getActiveProtocols().length;
    const byChain = this.getSupportedChains().reduce((acc, chain) => {
      acc[chain] = this.getProtocolsByChain(chain).length;
      return acc;
    }, {} as Record<Chain, number>);

    const byFeatures = {
      v2: this.getProtocolsByFeatures({ v2: true }).length,
      v3: this.getProtocolsByFeatures({ v3: true }).length,
      concentrated: this.getProtocolsByFeatures({ concentrated: true }).length,
      stable: this.getProtocolsByFeatures({ stable: true }).length,
    };

    return {
      total,
      active,
      byChain,
      byFeatures,
    };
  }
}

// Export protocol lists by chain for easy access
export const ETHEREUM_PROTOCOLS = Object.keys(ethereumProtocols);
export const L2_PROTOCOLS = Object.keys(l2Protocols);
export const SOLANA_PROTOCOLS = Object.keys(solanaProtocols);

// Export all protocol IDs
export const ALL_PROTOCOL_IDS = Object.keys(protocolRegistry);