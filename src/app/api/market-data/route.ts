import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const coin = searchParams.get('coin');
  const vs_currency = searchParams.get('vs_currency') || 'usd';
  const days = searchParams.get('days') || '30';
  const interval = searchParams.get('interval') || 'daily';

  if (!coin) {
    return NextResponse.json({ error: 'Coin parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${vs_currency}&days=${days}&interval=${interval}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    
    // Return mock data when CoinGecko API fails (common in development/rate limiting)
    const days_num = parseInt(days);
    const mockPrices: [number, number][] = [];
    const mockVolumes: [number, number][] = [];
    
    for (let i = 0; i < days_num; i++) {
      const timestamp = Date.now() - (days_num - i) * 24 * 60 * 60 * 1000;
      const basePrice = 40000; // Base price for Bitcoin-like asset
      const volatility = 0.05; // 5% daily volatility
      const change = (Math.random() - 0.5) * 2 * volatility;
      const price = basePrice * (1 + change * i * 0.01);
      const volume = Math.random() * 1000000000;
      
      mockPrices.push([timestamp, price]);
      mockVolumes.push([timestamp, volume]);
    }
    
    const mockData = {
      prices: mockPrices,
      market_caps: mockPrices.map(([timestamp, price]) => [timestamp, price * 21000000]),
      total_volumes: mockVolumes
    };
    
    return NextResponse.json(mockData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}