import { NextRequest, NextResponse } from 'next/server';
import { getProductionScanner } from '@/services/productionScanner';
import { getRealProductionScanner } from '@/services/realProductionScanner';
import { getFreeApiScanner } from '@/services/freeApiScanner';
import { getTrulyFreeScanner } from '@/services/truelyFreeScanner';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chain = searchParams.get('chain') || 'ethereum';

    console.log(`Scan request: address=${address}, chain=${chain}`);

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Basic address validation
    const isEthereumAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
    const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

    if (!isEthereumAddress && !isSolanaAddress) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Determine which scanner to use based on API keys and preferences
    const hasRealApiKeys = process.env.THE_GRAPH_API_KEY && process.env.THE_GRAPH_API_KEY !== 'your_the_graph_api_key_here';
    const useFreeApis = process.env.USE_FREE_APIS === 'true' || !hasRealApiKeys;
    const useTrulyFree = process.env.USE_TRULY_FREE === 'true' || (!hasRealApiKeys && useFreeApis);
    
    let scanner;
    if (hasRealApiKeys && !useFreeApis) {
      scanner = getRealProductionScanner();
      console.log('🔍 Using REAL production scanner with PAID APIs...');
    } else if (useTrulyFree) {
      scanner = getTrulyFreeScanner();
      console.log('🆓🆓 Using TRULY FREE scanner (no API keys needed)...');
    } else if (useFreeApis) {
      scanner = getFreeApiScanner();
      console.log('🆓 Using FREE API scanner (requires free API keys)...');
    } else {
      scanner = getProductionScanner();
      console.log('🎭 Using demo production scanner (fallback)...');
    }
    
    const scanResponse = await scanner.scanWallet(address, chain as any, {
      includeHistoricalData: true,
      includeFees: true,
      timeframe: '30d'
    });

    console.log('Scan response:', {
      success: scanResponse.success,
      hasData: !!scanResponse.data,
      error: scanResponse.error
    });

    if (!scanResponse.success) {
      return NextResponse.json(
        { success: false, error: scanResponse.error || 'Scan failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        data: scanResponse.data,
        message: 'Wallet scanned successfully'
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );

  } catch (error) {
    console.error('Scan wallet API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}