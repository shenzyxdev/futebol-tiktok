⚽ Pixel Penalty Showdown + VAR (TikTok LIVE Interactive Game)
Um jogo interativo de disputas de pênaltis em Pixel Art 16-Bits desenvolvido para transmissões ao vivo no TikTok LIVE (via OBS Studio, TikTok Live Studio ou Mobile). Os espectadores controlam a partida em tempo real através do chat, curtidas, novos seguidores e combos especiais.

✨ Funcionalidades Principais
🏟️ 10 Gigantes do Futebol (Brasil & Europa):
Brasil (B1 a B5): Flamengo, Corinthians, Palmeiras, São Paulo e Vasco.
Europa (E1 a E5): Real Madrid, Barcelona, Manchester City, PSG e Bayern de Munique.
Uniformes oficiais desenhados em Pixel Art e escudos em SVG vetorial.
🗳️ Votação Pré-Jogo Ao Vivo (60s): A audiência vota no chat (B1 a B5 ou E1 a E5) e os 2 times mais votados no geral entram em campo (permitindo clássicos brasileiros, europeus ou mundiais).
👟 Fila de Batedores + Barreira Ao Vivo:
Comentar 1 ou 2 coloca o espectador (com foto de perfil real e @nome) na Barreira de Defensores e na Fila de Pênaltis.
📺 Sistema de VAR Animado: Combos médios acionam o juiz do VAR correndo até a cabine para anular gols do adversário e bonificar o time aliado.
🔥 Chute de Fogo (Super Poder): Combos especiais acionam um chute em chamas valendo múltiplos gols com explosão de partículas e grito da torcida.
🏃 Invasor de Campo (Novos Seguidores): Quem segue a live invade o gramado correndo com a própria foto e marca gols bônus para o seu time.
💗 Energia da Torcida (Curtidas): A cada 100 curtidas o espectador fura a fila de batedores; ao bater a meta global da barra, ativa o Modo Fúria (Gols 2X).
🏆 Trono da Bola de Ouro (Ballon d'Or): Ranking dinâmico no topo da tela que coroa com foto e pontuação (XP) o espectador mais engajado da partida.
🔊 Motor de Áudio Sintetizado (Zero Copyright): Som contínuo de torcida na arquibancada, música estilo Samba/Arcade, apito, chute e narrador em português via Web Audio API.
🛡️ Blindagem Anti-OCR & Anti-Freeze (60 FPS): Interface limpa e loop via Web Worker para não travar mesmo com a janela em segundo plano.

🚀 Como Instalar e Rodar em Qualquer Computador
1. Pré-requisitos
Ter o Node.js instalado no computador.
2. Clonar ou Baixar o Repositório
No terminal (Git Bash ou CMD), execute:
git clone https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
cd NOME_DO_REPOSITORIO
(Ou simplesmente baixe o arquivo .zip pelo botão verde Code -> Download ZIP no GitHub e extraia em uma pasta).
3. Instalar as Dependências
Dentro da pasta do projeto, instale os pacotes necessários:
npm install express socket.io tiktok-live-connector@latest
4. Iniciar o Servidor
Execute o comando abaixo para ligar o servidor local:
node server.js

🖥️ Como Usar na Transmissão (OBS / TikTok Live Studio)
Painel de Controle (PC):
Abra no navegador: http://localhost:3000
Digite o @usuario da conta que está ao vivo no TikTok e clique em Conectar Live.
Tela Limpa Vertical 9:16 (Para Captura de Janela ou Navegador):
Abra em uma nova janela separada do navegador: http://localhost:3000/?mode=obs
No TikTok Live Studio ou OBS Studio, adicione uma fonte de Captura de Janela (ou Navegador com resolução 414x736) apontando para essa janela.
Dê um clique no gramado para destravar o áudio da torcida e da música.

🛠️ Estrutura de Arquivos
index.html — Motor gráfico Canvas 2D em Pixel Art, interface vertical 9:16, sintetizador de áudio de estádio e painel de controle administrativo.
server.js — Servidor Node.js + Socket.io integrado ao tiktok-live-connector (compatível com v1.x e v2.5+ com bypass direto de roomId).
package.json — Lista de dependências do projeto.
