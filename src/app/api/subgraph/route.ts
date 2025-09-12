import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    // Get subgraph endpoint from query parameters or default to Uniswap V3
    const searchParams = request.nextUrl.searchParams;
    const subgraph = searchParams.get('subgraph') || 'uniswap-v3';
    
    // Map subgraph names to URLs (using free public endpoints)
    const subgraphUrls: Record<string, string> = {
      'uniswap-v3': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
      'uniswap-v2': 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', 
      'sushiswap': 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
    };

    const subgraphUrl = subgraphUrls[subgraph];
    if (!subgraphUrl) {
      return NextResponse.json({ error: `Unsupported subgraph: ${subgraph}` }, { status: 400 });
    }

    console.log('Making request to subgraph:', subgraphUrl);
    console.log('Query length:', body.query?.length || 0);
    
    // Make request to The Graph
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: body.query,
        variables: body.variables || {},
      }),
    });

    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('The Graph API error response:', errorText);
      throw new Error(`The Graph API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Check for GraphQL errors
    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL errors:', data.errors);
      return NextResponse.json({
        error: 'GraphQL query error',
        details: data.errors,
      }, { status: 400 });
    }

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error proxying subgraph request:', error);
    
    // Return detailed error for debugging in development
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        error: 'Subgraph request failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }, { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // Return mock data for production fallback
    const mockData = {
      data: {
        positions: []
      }
    };
    
    return NextResponse.json(mockData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}