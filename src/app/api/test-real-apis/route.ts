import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const testResults: Record<string, any> = {};

    // Test The Graph API
    const theGraphApiKey = process.env.THE_GRAPH_API_KEY;
    if (theGraphApiKey && theGraphApiKey !== 'your_the_graph_api_key_here') {
      try {
        const subgraphId = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
        const endpoint = `https://gateway.thegraph.com/api/${theGraphApiKey}/subgraphs/id/${subgraphId}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              {
                positions(first: 1) {
                  id
                  owner
                }
              }
            `
          }),
        });

        if (response.ok) {
          const data = await response.json();
          testResults.theGraph = {
            status: 'working',
            endpoint: endpoint.replace(theGraphApiKey, '[REDACTED]'),
            data: data
          };
        } else {
          testResults.theGraph = {
            status: 'error',
            error: `HTTP ${response.status}: ${response.statusText}`
          };
        }
      } catch (error) {
        testResults.theGraph = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      testResults.theGraph = {
        status: 'not_configured',
        message: 'THE_GRAPH_API_KEY not configured'
      };
    }

    // Test CoinGecko API
    const coinGeckoApiKey = process.env.COINGECKO_API_KEY;
    if (coinGeckoApiKey && coinGeckoApiKey !== 'your_coingecko_api_key') {
      try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&x_cg_demo_api_key=${coinGeckoApiKey}`);
        
        if (response.ok) {
          const data = await response.json();
          testResults.coinGecko = {
            status: 'working',
            data: data
          };
        } else {
          testResults.coinGecko = {
            status: 'error',
            error: `HTTP ${response.status}: ${response.statusText}`
          };
        }
      } catch (error) {
        testResults.coinGecko = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } else {
      testResults.coinGecko = {
        status: 'not_configured',
        message: 'COINGECKO_API_KEY not configured'
      };
    }

    // Test Meteora API
    const meteoraApiUrl = process.env.METEORA_DLMM_API_URL || 'https://dlmm-api.meteora.ag';
    try {
      const response = await fetch(`${meteoraApiUrl}/pair/all`);
      
      if (response.ok) {
        const data = await response.json();
        testResults.meteora = {
          status: 'working',
          endpoint: meteoraApiUrl,
          pairsCount: Array.isArray(data) ? data.length : 'unknown'
        };
      } else {
        testResults.meteora = {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      testResults.meteora = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test Solana RPC
    const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    try {
      const response = await fetch(solanaRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        testResults.solanaRpc = {
          status: 'working',
          endpoint: solanaRpcUrl,
          health: data.result
        };
      } else {
        testResults.solanaRpc = {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      testResults.solanaRpc = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Summary
    const workingApis = Object.values(testResults).filter((result: any) => result.status === 'working').length;
    const totalApis = Object.keys(testResults).length;

    return NextResponse.json({
      success: true,
      summary: {
        working: workingApis,
        total: totalApis,
        ready_for_production: workingApis >= 2 // At least 2 APIs working
      },
      apis: testResults,
      instructions: {
        message: "To enable real data, configure API keys in .env.local",
        required_keys: [
          "THE_GRAPH_API_KEY - Get from https://thegraph.com/studio/",
          "COINGECKO_API_KEY - Get from https://www.coingecko.com/en/api",
          "SOLANA_RPC_URL - Use https://api.mainnet-beta.solana.com or get from Alchemy/QuickNode"
        ],
        setup_guide: "Copy .env.example to .env.local and fill in your API keys"
      }
    });

  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}