# LP Tracker API Documentation

This document provides comprehensive documentation for the LP Tracker API endpoints.

## Base URL

```
http://localhost:3000/api (development)
https://your-domain.com/api (production)
```

## Authentication

Currently, the API does not require authentication for public endpoints. Rate limiting is applied per IP address.

## Rate Limits

- **Scan endpoints**: 10 requests per 5 minutes
- **Protocol endpoints**: 60 requests per minute  
- **Position endpoints**: 100 requests per minute
- **Analytics endpoints**: 20 requests per 5 minutes
- **Health endpoints**: 30 requests per minute

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets
- `X-RateLimit-Window`: Window size in milliseconds

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": <response_data>,
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [<array_of_items>],
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Endpoints

### 1. Health Check

Check the health status of the API and its dependencies.

#### GET /api/health

**Description**: Get basic system health status

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 86400,
    "version": "1.0.0",
    "services": {
      "database": "healthy",
      "cache": "healthy",
      "external_apis": {
        "defi_llama": "healthy",
        "coingecko": "healthy"
      }
    },
    "memory": {
      "used": 245,
      "total": 512,
      "percentage": 48
    },
    "performance": {
      "responseTimeMs": 150,
      "requests24h": 8500,
      "errors24h": 12
    }
  }
}
```

#### POST /api/health

**Description**: Perform detailed health check with custom options

**Request Body**:
```json
{
  "checkDatabase": true,
  "checkCache": true,
  "checkExternalApis": true,
  "includeMetrics": true
}
```

### 2. Protocol Management

Manage and retrieve information about supported DeFi protocols.

#### GET /api/protocols

**Description**: List all supported protocols with optional filtering

**Query Parameters**:
- `chain` (optional): Filter by blockchain (ethereum, solana, arbitrum, polygon, base)
- `supported` (optional): Filter by support status (true/false)
- `includeMetrics` (optional): Include TVL, volume, and other metrics (default: false)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uniswap-v3",
      "name": "Uniswap V3",
      "chain": "ethereum",
      "description": "The most popular decentralized exchange protocol...",
      "logoUri": "https://example.com/logo.png",
      "website": "https://uniswap.org",
      "documentation": "https://docs.uniswap.org",
      "supported": true,
      "version": "3.0.0",
      "fees": {
        "trading": 0.05,
        "withdrawal": 0
      },
      "supportedFeatures": ["concentrated-liquidity", "multiple-fee-tiers"],
      "riskLevel": "medium",
      "metrics": {
        "tvl": 4200000000,
        "volume24h": 1500000000,
        "users24h": 45000,
        "avgApr": 15.5,
        "positions": 180000,
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 8,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### GET /api/protocols/[chain]

**Description**: Get protocols for a specific blockchain

**Path Parameters**:
- `chain`: Blockchain identifier (ethereum, solana, arbitrum, polygon, base)

**Query Parameters**:
- `supported` (optional): Filter by support status
- `includeMetrics` (optional): Include protocol metrics

**Response**:
```json
{
  "success": true,
  "data": {
    "chain": "ethereum",
    "protocols": [...],
    "aggregatedMetrics": {
      "totalTvl": 12500000000,
      "totalVolume24h": 3000000000,
      "totalUsers24h": 125000,
      "totalPositions": 450000,
      "averageApr": 12.8,
      "protocolCount": 5,
      "supportedProtocolCount": 5
    },
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Wallet Scanning

Scan wallet addresses across DeFi protocols to find LP positions.

#### POST /api/scan/[wallet]

**Description**: Start a new wallet scan across all supported protocols

**Path Parameters**:
- `wallet`: Wallet address (Ethereum or Solana format)

**Request Body** (optional):
```json
{
  "chains": ["ethereum", "solana"],
  "protocols": ["uniswap-v3", "raydium-clmm"],
  "includeHistorical": false,
  "refresh": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "scanId": "scan_1234567890_abc123",
    "status": "queued",
    "estimatedTime": 20
  },
  "message": "Scan started successfully"
}
```

#### GET /api/scan/[wallet]?scanId=xxx

**Description**: Get scan progress or results

**Path Parameters**:
- `wallet`: Wallet address

**Query Parameters**:
- `scanId`: Scan job identifier

**Response (In Progress)**:
```json
{
  "success": true,
  "data": {
    "scanId": "scan_1234567890_abc123",
    "status": "scanning",
    "progress": 65,
    "currentProtocol": "uniswap-v3",
    "completedProtocols": ["curve", "balancer"],
    "failedProtocols": [],
    "estimatedTimeRemaining": 7,
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (Completed)**:
```json
{
  "success": true,
  "data": {
    "chain": "ethereum",
    "walletAddress": "0x1234...5678",
    "totalValue": 125000,
    "totalPositions": 8,
    "totalFeesEarned": 8500,
    "avgApr": 15.2,
    "protocols": {
      "uniswap-v3": {
        "protocol": {...},
        "positions": [...],
        "totalValue": 75000,
        "totalPositions": 5,
        "totalFeesEarned": 5500,
        "avgApr": 18.5,
        "isLoading": false
      }
    },
    "lastUpdated": "2024-01-01T00:00:00.000Z",
    "scanDuration": 25000
  }
}
```

### 4. Position Management

Manage and retrieve detailed information about individual LP positions.

#### GET /api/positions/[id]

**Description**: Get detailed information about a specific position

**Path Parameters**:
- `id`: Position identifier

**Query Parameters**:
- `includeHistorical` (optional): Include historical performance data
- `includePredictions` (optional): Include AI-powered predictions
- `timeframe` (optional): Timeframe for historical data (1h, 24h, 7d, 30d, 90d, 1y)

**Response**:
```json
{
  "success": true,
  "data": {
    "position": {
      "id": "uniswap-v3-0x1234-0",
      "protocol": "uniswap-v3",
      "chain": "ethereum",
      "pool": "ETH/USDC-0.05%",
      "liquidity": 125000,
      "value": 45000,
      "feesEarned": 2850,
      "apr": 18.5,
      "inRange": true,
      "tokens": {
        "token0": {
          "symbol": "ETH",
          "amount": 12.5
        },
        "token1": {
          "symbol": "USDC",
          "amount": 32500
        }
      },
      "priceRange": {
        "lower": 2800,
        "upper": 3200,
        "current": 3000
      }
    },
    "historical": [...],
    "predictions": [...],
    "recommendations": {
      "action": "hold",
      "reasoning": "Position is performing well and within optimal parameters.",
      "urgency": "low",
      "expectedImpact": {
        "aprChange": 0,
        "valueChange": 0,
        "riskChange": "maintain"
      }
    }
  }
}
```

#### PUT /api/positions/[id]

**Description**: Update position details (manual adjustments)

**Request Body**:
```json
{
  "liquidity": 130000,
  "tickLower": 194000,
  "tickUpper": 206000
}
```

#### DELETE /api/positions/[id]

**Description**: Remove position from tracking

### 5. Analytics

Advanced portfolio analytics and performance metrics.

#### GET /api/analytics

**Description**: Get portfolio analytics with optional comparisons and forecasting

**Query Parameters**:
- `timeframe` (optional): Analysis timeframe (24h, 7d, 30d, 90d, 1y)
- `includeComparisons` (optional): Include vs HODL and market comparisons
- `includeForecasting` (optional): Include future predictions

#### POST /api/analytics

**Description**: Get analytics for multiple wallets or custom parameters

**Request Body**:
```json
{
  "wallets": ["0x123...", "9WzD..."],
  "timeframe": "30d",
  "includeComparisons": true,
  "includeForecasting": true
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "aggregates": {
      "totalValueLocked": 1250000,
      "totalFeesEarned": 85000,
      "totalPositions": 15,
      "activeProtocols": 6,
      "averageApr": 16.8,
      "totalImpermanentLoss": -5000,
      "portfolioROI": 18.2,
      "bestPerformingProtocol": "raydium-clmm",
      "worstPerformingProtocol": "curve"
    },
    "timeframe": "30d",
    "comparison": {
      "vsHodl": {
        "outperformance": 5.8,
        "timeToBreakeven": 15,
        "riskAdjustedReturn": 15.8
      },
      "vsMarket": {
        "beta": 0.85,
        "alpha": 5.2,
        "sharpeRatio": 1.35
      }
    },
    "forecasting": {
      "nextWeek": {
        "expectedFees": 1800,
        "expectedValue": 1275000,
        "confidence": 0.75
      }
    },
    "topOpportunities": [
      {
        "protocol": "meteora-dlmm",
        "pool": "SOL/USDC",
        "apr": 24.8,
        "tvl": 45000000,
        "riskLevel": "medium",
        "reasoning": "High APR with growing TVL on Solana..."
      }
    ]
  }
}
```

## Error Codes

Common error codes returned by the API:

| Code | Description |
|------|-------------|
| `INVALID_WALLET_ADDRESS` | Wallet address format is invalid |
| `UNSUPPORTED_CHAIN` | Blockchain is not supported |
| `INVALID_PROTOCOL` | Protocol is not supported |
| `MISSING_REQUIRED_FIELD` | Required field is missing from request |
| `RATE_LIMIT_EXCEEDED` | Too many requests, try again later |
| `SCAN_IN_PROGRESS` | Wallet scan is already running |
| `SCAN_FAILED` | Wallet scan encountered an error |
| `POSITION_NOT_FOUND` | Position ID does not exist |
| `INSUFFICIENT_DATA` | Not enough data for analytics calculation |
| `SERVICE_UNAVAILABLE` | External service is temporarily unavailable |

## Examples

### Start a wallet scan

```bash
curl -X POST http://localhost:3000/api/scan/0x1234567890abcdef1234567890abcdef12345678 \
  -H "Content-Type: application/json" \
  -d '{
    "chains": ["ethereum"],
    "protocols": ["uniswap-v3", "curve"],
    "includeHistorical": true
  }'
```

### Check scan progress

```bash
curl -X GET "http://localhost:3000/api/scan/0x1234567890abcdef1234567890abcdef12345678?scanId=scan_1234567890_abc123"
```

### Get protocol list

```bash
curl -X GET "http://localhost:3000/api/protocols?chain=ethereum&includeMetrics=true"
```

### Get analytics

```bash
curl -X GET "http://localhost:3000/api/analytics?timeframe=30d&includeComparisons=true"
```

## Development

To run the API locally:

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## Production Considerations

1. **Database**: Replace in-memory stores with persistent database (PostgreSQL, MongoDB)
2. **Cache**: Implement Redis for caching and rate limiting
3. **Queue System**: Use Bull/BullMQ for async job processing
4. **Monitoring**: Add proper logging, metrics, and health monitoring
5. **Security**: Implement authentication, input sanitization, and security headers
6. **Rate Limiting**: Use distributed rate limiting with Redis
7. **Error Handling**: Implement comprehensive error tracking (Sentry, etc.)
8. **Documentation**: Use OpenAPI/Swagger for interactive API documentation

## Support

For questions or issues, please refer to the project documentation or create an issue in the repository.