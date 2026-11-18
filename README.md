# Territory War — GTA VI x Zelda: Ocarina of Time (jogo para live do TikTok)

## Como rodar
1. Coloque o @ da live (sem o @) no arquivo `.env`:
   `TIKTOK_USERNAME=seuperfil`
2. No terminal, dentro desta pasta: `npm start`
3. Abra http://localhost:3000

A live precisa estar NO AR para conectar. Se cair, o servidor tenta de novo a cada 30s.

## Comandos do chat na live
- **GTA VI:** comentar `1`, `gta`, `gta6` ou `gtavi`
- **Zelda (Ocarina of Time):** comentar `2`, `zelda`, `oot`, `ocarina` ou `link`

## OBS
Fonte "Navegador" → URL `http://localhost:3000` → Largura 1080, Altura 1920.
O fundo já é transparente.

## Modo simulação (teste sem live)
- **S** liga/desliga eventos falsos automáticos
- **1** / **2**: comentário GTA VI / Zelda OoT
- **L**: curtida • **R**: rosa (1 moeda) • **M**: meteoros (5-19 moedas)
- **B**: tanque (20+ moedas) • **F**: seguir • **V**: forçar fim da rodada
- Ou abra `http://localhost:3000/?sim` para já começar simulando.
