Use a biblioteca npm tiktok-live-connector (v2).
- Use import (ESM). Nunca use require.
- Classe: TikTokLiveConnection(usuario, {})
O 2o argumento {} é obrigatório.
- Eventos: WebcastEvent.CHAT, GIFT, LIKE,
FOLLOW, MEMBER
- Só conecta com a live NO AR. Usuário sem @.
- Confira os campos com console.log antes
de usar.
- Arquitetura: servidor Node envia os eventos
da live para a página do jogo (Socket.IO).
- Todo jogo tem MODO SIMULAÇÃO (tecla S).
- Docs: github.com/zerodytrash/TikTok-Live-Connector
Responda em português simples e rode os
comandos você mesmo.
