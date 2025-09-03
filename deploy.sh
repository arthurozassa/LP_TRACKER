#!/bin/bash

echo "🚀 Deploy Script para LP_TRACKER"
echo "================================"

# Limpar configurações conflitantes
git config user.name "arthurozassa"
git config user.email "arthurozassa@gmail.com"

# Adicionar todos os arquivos
git add .

# Commit se houver mudanças
git commit -m "🚀 Complete Universal LP Position Tracker

✅ Next.js 14 + TypeScript + Tailwind CSS
✅ Multi-chain wallet scanning (Ethereum/Solana)  
✅ 15+ DEX protocol support with glassmorphism UI
✅ Real-time chain detection and validation
✅ Comprehensive dashboard with metrics and charts
✅ Responsive design and smooth animations
✅ Mock data for demo addresses

Ready for Vercel deployment! 🎉"

# Push para GitHub
echo "Fazendo push para GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "✅ Código enviado para GitHub com sucesso!"
    echo "🔗 Repositório: https://github.com/arthurozassa/LP_TRACKER"
    echo ""
    echo "🚀 PRÓXIMO PASSO - DEPLOY NO VERCEL:"
    echo "1. Acesse: https://vercel.com/new"
    echo "2. Import Git Repository"  
    echo "3. Selecione: LP_TRACKER"
    echo "4. Clique: Deploy"
    echo ""
    echo "🎉 Sua aplicação ficará disponível em poucos minutos!"
else
    echo "❌ Erro no push. Tente executar manualmente:"
    echo "git push -u origin main"
fi