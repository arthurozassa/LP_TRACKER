# 🚀 CONFIGURAÇÃO PARA PRODUÇÃO COM DADOS REAIS

Este guia mostra como configurar o LP Position Tracker para usar dados reais de APIs de produção.

## 🔑 CHAVES DE API NECESSÁRIAS

### 1. The Graph API Key (OBRIGATÓRIA para Ethereum)
- **Site**: https://thegraph.com/studio/
- **Função**: Dados de posições Uniswap V3/V2, SushiSwap via subgraphs
- **Configuração**: `THE_GRAPH_API_KEY=your_api_key_here`
- **Custo**: Gratuito até certo limite, depois pago por query

### 2. CoinGecko API Key (OBRIGATÓRIA para preços)
- **Site**: https://www.coingecko.com/en/api
- **Função**: Preços de tokens em tempo real
- **Configuração**: `COINGECKO_API_KEY=your_api_key_here`
- **Custo**: $129/mês para Pro API

### 3. Solana RPC Endpoint (OBRIGATÓRIA para Solana)
- **Sites**: 
  - Alchemy: https://www.alchemy.com/solana
  - QuickNode: https://www.quicknode.com/chains/sol
  - GenesysGo: https://shdw.genesysgo.com/
- **Função**: Conexão com blockchain Solana
- **Configuração**: `SOLANA_RPC_URL=your_rpc_endpoint`
- **Custo**: Varia por provedor

### 4. SolanaTracker API (OPCIONAL para Solana DEXs)
- **Site**: https://www.solanatracker.io/data-api
- **Função**: Dados de Raydium, Orca, etc.
- **Configuração**: `SOLANATRACKER_API_KEY=your_api_key_here`
- **Custo**: A partir de $99/mês

## ⚙️ CONFIGURAÇÃO PASSO A PASSO

### 1. Copiar Arquivo de Configuração
```bash
cp .env.example .env.local
```

### 2. Editar .env.local com Suas Chaves
```bash
# OBRIGATÓRIAS PARA DADOS REAIS
THE_GRAPH_API_KEY=sua_chave_do_the_graph
COINGECKO_API_KEY=sua_chave_do_coingecko
SOLANA_RPC_URL=sua_url_rpc_solana

# OPCIONAIS PARA FUNCIONALIDADES AVANÇADAS
SOLANATRACKER_API_KEY=sua_chave_solanatracker
BITQUERY_API_KEY=sua_chave_bitquery

# SUBGRAPH IDs (já configurados)
UNISWAP_V3_SUBGRAPH_ID=5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV
UNISWAP_V2_SUBGRAPH_ID=A3Np3RQbaBA6oKJgiwDJRkczo-5PINakUfGZthJ6V6B5
```

### 3. Testar APIs
```bash
# Durante desenvolvimento
curl http://localhost:3000/api/test-real-apis

# Em produção
curl https://seu-dominio.com/api/test-real-apis
```

## 🔍 VERIFICAÇÃO DO STATUS

O sistema automaticamente detecta se as chaves estão configuradas:

- **🔍 Com chaves configuradas**: Usa scanner real com dados de produção
- **🎭 Sem chaves**: Usa scanner demo com dados simulados

### Endpoint de Teste
```
GET /api/test-real-apis
```

Retorna:
```json
{
  "success": true,
  "summary": {
    "working": 3,
    "total": 4,
    "ready_for_production": true
  },
  "apis": {
    "theGraph": { "status": "working" },
    "coinGecko": { "status": "working" },
    "meteora": { "status": "working" },
    "solanaRpc": { "status": "not_configured" }
  }
}
```

## 📊 DADOS COLETADOS POR PROTOCOLO

### Ethereum (The Graph)
- **Uniswap V3**: Posições, liquidez, fees coletadas, range status
- **Uniswap V2**: LP tokens, share do pool, fees estimadas
- **SushiSwap**: Posições de liquidez
- **Curve Finance**: Pools estáveis
- **Balancer**: Pools multi-token

### Solana (APIs Nativas)
- **Meteora DLMM**: Posições via API oficial
- **Raydium CLMM**: Via SolanaTracker ou RPC direto
- **Orca Whirlpools**: Via SDK oficial
- **Jupiter**: Agregação de liquidez

### L2 Networks
- **Arbitrum**: Uniswap V3, SushiSwap, Curve
- **Polygon**: QuickSwap, SushiSwap, Curve
- **Base**: SpookySwap, Uniswap V3

## 🚀 DEPLOY EM PRODUÇÃO

### Vercel (Recomendado)
1. **Configurar Variáveis de Ambiente**:
   ```bash
   vercel env add THE_GRAPH_API_KEY
   vercel env add COINGECKO_API_KEY
   vercel env add SOLANA_RPC_URL
   ```

2. **Deploy**:
   ```bash
   vercel --prod
   ```

### Railway
```bash
railway login
railway env set THE_GRAPH_API_KEY=sua_chave
railway env set COINGECKO_API_KEY=sua_chave
railway deploy
```

### Netlify
```bash
netlify env:set THE_GRAPH_API_KEY sua_chave
netlify env:set COINGECKO_API_KEY sua_chave
netlify deploy --prod
```

## 💰 ESTIMATIVA DE CUSTOS MENSAIS

### Configuração Mínima (Small Scale)
- **The Graph**: $50-100/mês
- **CoinGecko Pro**: $129/mês
- **Solana RPC (Alchemy)**: $49/mês
- **Total**: ~$228-278/mês

### Configuração Completa (Enterprise)
- **The Graph**: $200-500/mês
- **CoinGecko Pro**: $129/mês
- **SolanaTracker**: $99/mês
- **Bitquery**: $299/mês
- **Premium RPC**: $199/mês
- **Total**: ~$926-1227/mês

## 📈 LIMITES E PERFORMANCE

### The Graph
- **Gratuito**: 100k queries/mês
- **Pago**: Ilimitado com billing por query

### CoinGecko
- **Gratuito**: 30 calls/minuto
- **Pro**: 500 calls/minuto + dados históricos

### Solana RPC
- **Público**: Rate limited, não confiável
- **Alchemy**: 300 CU/second (Basic)
- **QuickNode**: 25 requests/second (Starter)

## 🛡️ SEGURANÇA

### Variáveis de Ambiente
- ✅ Nunca commitar chaves no código
- ✅ Usar .env.local para desenvolvimento
- ✅ Configurar no provedor de hosting para produção
- ✅ Rotacionar chaves regularmente

### Rate Limiting
- Implementado cache para reduzir calls
- Retry automático com backoff exponencial
- Fallback para dados demo se APIs falharem

## 🔧 TROUBLESHOOTING

### "THE_GRAPH_API_KEY not configured"
1. Verificar se .env.local existe
2. Verificar se a chave não é o valor placeholder
3. Reiniciar servidor de desenvolvimento

### "GraphQL errors: Invalid subgraph"
1. Verificar se UNISWAP_V3_SUBGRAPH_ID está correto
2. Testar endpoint manualmente
3. Verificar se subgraph está deployado

### "Solana RPC connection failed"
1. Testar SOLANA_RPC_URL manualmente
2. Verificar rate limits do provedor
3. Considerar usar backup RPC

## 📞 SUPORTE

Para dúvidas sobre configuração:
1. Testar endpoint `/api/test-real-apis`
2. Verificar logs do servidor
3. Consultar documentação dos provedores de API