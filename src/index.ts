import express, { Request, Response } from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import xss from "xss-clean";
import { PORT } from "./config/api-config";
import { sessionConfig, redisClient } from "./config/session-config";
import {
  getSpotifyAuthUrl,
  exchangeSpotifyCodeForToken,
} from "./auth/spotify-auth";
import {
  getYouTubeAuthUrl,
  exchangeYouTubeCodeForToken,
  getAuthenticatedClient,
} from "./auth/youtube-auth";
import { SpotifyService } from "./services/spotify-service";
import { YouTubeService } from "./services/youtube-service";
import { MigrationController } from "./controllers/migration-controller";
import { SpotifyTokens, YouTubeTokens } from "./types";
import { TempTokenManager } from "./utils/temp-token-manager";

// Declaração de tipos para sessão
declare module "express-session" {
  interface SessionData {
    spotifyTokens?: SpotifyTokens;
    youtubeTokens?: YouTubeTokens;
  }
}

const app = express();

// ===== SEGURANÇA =====

// 1. Helmet - Headers de segurança (desabilitando CSP por enquanto devido ao HTML inline)
app.use(
  helmet({
    contentSecurityPolicy: false, // Desabilitar CSP pois usamos muito HTML inline
  })
);

// 2. XSS Protection
app.use(xss());

// 3. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: "Muitas requisicoes deste IP. Tente novamente em 15 minutos.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 tentativas de auth por hora
  message: "Muitas tentativas de autenticacao. Tente novamente em 1 hora.",
});

const migrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 migrações por hora
  message: "Limite de migracoes atingido. Tente novamente em 1 hora.",
});

// Aplicar rate limiting geral
app.use(limiter);

// ===== FIM SEGURANÇA =====

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));

// --- STYLES & TEMPLATES (Para manter o código limpo e consistente) ---
const globalStyles = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    :root {
      --bg: #121212;
      --card: #1E1E1E;
      --text: #E0E0E0;
      --text-muted: #A0A0A0;
      --spotify: #1DB954;
      --youtube: #FF0000;
      --border: #333;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 20px;
      display: flex;
      justify-content: center;
      min-height: 100vh;
      align-items: center;
    }
    .container {
      background: var(--card);
      padding: 40px;
      border-radius: 24px;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      text-align: center;
      border: 1px solid var(--border);
    }
    h1 { font-size: 24px; margin-bottom: 10px; font-weight: 700; letter-spacing: -0.5px; }
    h2 { font-size: 18px; margin-top: 30px; margin-bottom: 15px; color: var(--text-muted); font-weight: 600; }
    p { color: var(--text-muted); line-height: 1.6; }
    
    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 16px;
      margin: 10px 0;
      background-color: #333;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      transition: transform 0.2s, opacity 0.2s;
      border: 1px solid transparent;
    }
    .button:hover { transform: translateY(-2px); opacity: 0.9; }
    .button.spotify { background-color: var(--spotify); color: #000; }
    .button.youtube { background-color: rgba(255, 0, 0, 0.1); color: var(--youtube); border-color: var(--youtube); }
    .button.youtube:hover { background-color: var(--youtube); color: white; }
    .button.primary { background: white; color: black; }
    
    .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 30px; }
    .status-item { background: #2a2a2a; padding: 15px; border-radius: 12px; font-size: 14px; }
    .status-item span { display: block; font-weight: bold; margin-bottom: 5px; font-size: 16px; }
    .connected { color: var(--spotify); }
    .disconnected { color: #666; }

    /* Playlist Styles */
    .playlist-list { text-align: left; margin-top: 20px; }
    .playlist-card {
      background: #252525;
      padding: 20px;
      border-radius: 16px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.2s;
    }
    .playlist-card:hover { background: #2e2e2e; }
    .playlist-info h3 { margin: 0 0 5px 0; font-size: 16px; color: white; }
    .playlist-info p { margin: 0; font-size: 13px; }
    .btn-sm { padding: 8px 16px; font-size: 13px; width: auto; margin: 0; }
    
    /* Terminal / Logs */
    pre {
      background: #000;
      color: #0f0;
      padding: 20px;
      border-radius: 12px;
      text-align: left;
      font-family: 'Courier New', monospace;
      overflow-x: auto;
      border: 1px solid #333;
      max-height: 400px;
      overflow-y: auto;
      font-size: 13px;
    }
    a { color: inherit; }
  </style>
`;

// --- ROUTES ---

app.get("/", (req: Request, res: Response) => {
  console.log(`📄 Página inicial - Session ID: ${req.sessionID}`);
  console.log(
    `🔍 Tokens na sessão: Spotify=${!!req.session
      .spotifyTokens}, YouTube=${!!req.session.youtubeTokens}`
  );

  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Migration Tool</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${globalStyles}
        </head>
        <body>
            <div class="container">
                <h1>Transferência de Playlists</h1>
                <p>Mova suas músicas do Spotify para o YouTube de forma simples.</p>
                
                <div class="status-grid">
                    <div class="status-item">
                        <span>Spotify</span>
                        ${
                          req.session.spotifyTokens
                            ? '<b class="connected">● Conectado</b>'
                            : '<b class="disconnected">○ Pendente</b>'
                        }
                    </div>
                    <div class="status-item">
                        <span>YouTube</span>
                        ${
                          req.session.youtubeTokens
                            ? '<b class="connected">● Conectado</b>'
                            : '<b class="disconnected">○ Pendente</b>'
                        }
                    </div>
                </div>

                ${
                  !req.session.spotifyTokens
                    ? `<a href="/auth/spotify" class="button spotify">Conectar Spotify</a>`
                    : ""
                }
                
                ${
                  !req.session.youtubeTokens
                    ? `<a href="/auth/youtube" class="button youtube">Conectar YouTube</a>`
                    : ""
                }

                ${
                  req.session.spotifyTokens && req.session.youtubeTokens
                    ? `
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333;">
                        <p>Tudo pronto!</p>
                        <a href="/playlists" class="button primary">Ver Minhas Playlists →</a>
                    </div>
                `
                    : ""
                }
            </div>
        </body>
        </html>
    `);
});

// Aplicar rate limiter nas rotas de autenticação
app.get("/auth/spotify", authLimiter, (req: Request, res: Response) => {
  const stateCode = TempTokenManager.generateStateCode();

  if (req.session.youtubeTokens) {
    TempTokenManager.saveTokens(
      stateCode,
      undefined,
      req.session.youtubeTokens
    );
    console.log(
      "💾 Tokens do YouTube salvos antes de redirecionar para Spotify"
    );
  }

  const authUrl = getSpotifyAuthUrl(stateCode);
  console.log(`🔐 State code gerado: ${stateCode}`);
  res.redirect(authUrl);
});

app.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const stateCode = req.query.state as string; // State code agora vem da URL do OAuth

  if (!code) return res.status(400).send("Código não fornecido");

  try {
    const tokens = await exchangeSpotifyCodeForToken(code);

    console.log("✅ Spotify: Tokens recebidos");
    console.log(`🆔 Session ID: ${req.sessionID}`);
    console.log(`🔐 State code recebido: ${stateCode}`);

    // Recuperar tokens do YouTube do armazenamento temporário usando o state code
    let existingYoutubeTokens = req.session.youtubeTokens;

    if (stateCode) {
      const tempTokens = TempTokenManager.getTokens(stateCode);
      if (tempTokens?.youtubeTokens) {
        existingYoutubeTokens = tempTokens.youtubeTokens;
        console.log(
          `📥 Tokens do YouTube recuperados do armazenamento temporário (state: ${stateCode})`
        );
      } else {
        console.log(
          `⚠️ Nenhum token temporário encontrado para state: ${stateCode}`
        );
      }
    }

    console.log(
      `🔍 Sessão antes: Spotify=${!!req.session
        .spotifyTokens}, YouTube=${!!existingYoutubeTokens}`
    );

    // Salvar ambos os tokens na sessão
    req.session.spotifyTokens = tokens;

    if (existingYoutubeTokens) {
      req.session.youtubeTokens = existingYoutubeTokens;
      console.log("✅ Tokens do YouTube restaurados na sessão");
    }

    // Salvar sessão
    await new Promise<void>((resolve) => req.session.save(() => resolve()));

    console.log(
      `🔍 Sessão depois: Spotify=${!!req.session.spotifyTokens}, YouTube=${!!req
        .session.youtubeTokens}`
    );

    // Limpar armazenamento temporário
    if (stateCode) {
      TempTokenManager.clearTokens(stateCode);
    }

    res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sucesso</title>
                <meta http-equiv="refresh" content="2;url=/" />
                ${globalStyles}
            </head>
            <body>
                <div class="container">
                    <h1 style="color: var(--spotify);">Spotify Conectado</h1>
                    <p>Redirecionando...</p>
                </div>
            </body>
            </html>
        `);
  } catch (error: any) {
    res.status(500).send(`Erro: ${error.message}`);
  }
});

app.get("/auth/youtube", authLimiter, (req: Request, res: Response) => {
  const stateCode = TempTokenManager.generateStateCode();

  if (req.session.spotifyTokens) {
    TempTokenManager.saveTokens(
      stateCode,
      req.session.spotifyTokens,
      undefined
    );
    console.log(
      "💾 Tokens do Spotify salvos antes de redirecionar para YouTube"
    );
  }

  const authUrl = getYouTubeAuthUrl(stateCode);
  console.log(`🔐 State code gerado: ${stateCode}`);
  res.redirect(authUrl);
});

app.get("/google-callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const stateCode = req.query.state as string; // State code agora vem da URL do OAuth

  if (!code) return res.status(400).send("Código não fornecido");

  try {
    const tokens = await exchangeYouTubeCodeForToken(code);

    console.log("✅ YouTube: Tokens recebidos");
    console.log(`🆔 Session ID: ${req.sessionID}`);
    console.log(`🔐 State code recebido: ${stateCode}`);

    // Recuperar tokens do Spotify do armazenamento temporário usando o state code
    let existingSpotifyTokens = req.session.spotifyTokens;

    if (stateCode) {
      const tempTokens = TempTokenManager.getTokens(stateCode);
      if (tempTokens?.spotifyTokens) {
        existingSpotifyTokens = tempTokens.spotifyTokens;
        console.log(
          `📥 Tokens do Spotify recuperados do armazenamento temporário (state: ${stateCode})`
        );
      } else {
        console.log(
          `⚠️ Nenhum token temporário encontrado para state: ${stateCode}`
        );
      }
    }

    console.log(
      `🔍 Sessão antes: Spotify=${!!existingSpotifyTokens}, YouTube=${!!req
        .session.youtubeTokens}`
    );

    // Salvar ambos os tokens na sessão
    req.session.youtubeTokens = tokens;

    if (existingSpotifyTokens) {
      req.session.spotifyTokens = existingSpotifyTokens;
      console.log("✅ Tokens do Spotify restaurados na sessão");
    }

    // Salvar sessão
    await new Promise<void>((resolve) => req.session.save(() => resolve()));

    console.log(
      `🔍 Sessão depois: Spotify=${!!req.session.spotifyTokens}, YouTube=${!!req
        .session.youtubeTokens}`
    );

    // Limpar armazenamento temporário
    if (stateCode) {
      TempTokenManager.clearTokens(stateCode);
    }

    res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sucesso</title>
                <meta http-equiv="refresh" content="2;url=/" />
                ${globalStyles}
            </head>
            <body>
                <div class="container">
                    <h1 style="color: var(--youtube);">YouTube Conectado</h1>
                    <p>Redirecionando...</p>
                </div>
            </body>
            </html>
        `);
  } catch (error: any) {
    res.status(500).send(`Erro: ${error.message}`);
  }
});

app.get("/playlists", async (req: Request, res: Response) => {
  if (!req.session.spotifyTokens) return res.redirect("/");

  try {
    let spotifyService = new SpotifyService(
      req.session.spotifyTokens.access_token
    );

    let playlists;
    try {
      playlists = await spotifyService.getUserPlaylists();
    } catch (error: any) {
      // Se o token expirou, tentar renovar
      if (
        error.message.includes("Falha ao buscar playlists") &&
        req.session.spotifyTokens.refresh_token
      ) {
        console.log("Token do Spotify expirado, renovando...");
        const { refreshSpotifyToken } = await import("./auth/spotify-auth");
        const newTokens = await refreshSpotifyToken(
          req.session.spotifyTokens.refresh_token
        );
        req.session.spotifyTokens = newTokens;

        // Tentar novamente com o novo token
        spotifyService = new SpotifyService(newTokens.access_token);
        playlists = await spotifyService.getUserPlaylists();
        console.log("Token renovado com sucesso!");
      } else {
        throw error;
      }
    }

    let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Selecionar Playlist</title>
                ${globalStyles}
            </head>
            <body>
                <div class="container" style="max-width: 800px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                        <h1>Suas Playlists</h1>
                        <a href="/" style="color: #666; text-decoration: none; font-size: 14px;">Voltar</a>
                    </div>
                    <div class="playlist-list">
        `;

    playlists.forEach((playlist) => {
      html += `
                <div class="playlist-card">
                    <div class="playlist-info">
                        <h3>${playlist.name}</h3>
                        <p style="opacity: 0.7;">${playlist.trackCount} músicas</p>
                    </div>
                    <a href="/migrate/${playlist.id}" class="button btn-sm primary">Migrar</a>
                </div>
            `;
    });

    html += `
                    </div>
                </div>
            </body>
            </html>
        `;

    res.send(html);
  } catch (error: any) {
    res.status(500).send(error.message);
  }
});

app.get(
  "/migrate/:playlistId",
  migrationLimiter,
  async (req: Request, res: Response) => {
    if (!req.session.spotifyTokens || !req.session.youtubeTokens)
      return res.redirect("/");

    const { playlistId } = req.params;
    const privacyStatus =
      (req.query.privacy as "private" | "public" | "unlisted") || "private";

    try {
      const spotifyService = new SpotifyService(
        req.session.spotifyTokens.access_token
      );
      const youtubeClient = getAuthenticatedClient(req.session.youtubeTokens);
      const youtubeService = new YouTubeService(youtubeClient);
      const migrationController = new MigrationController(
        spotifyService,
        youtubeService
      );

      // Definir Content-Type como HTML
      res.setHeader('Content-Type', 'text/html; charset=utf-8');

      // Initial HTML setup with streaming log style
      res.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migrando Playlist...</title>
                ${globalStyles}
                <style>
                    .progress-container {
                        width: 100%;
                        background: #2a2a2a;
                        border-radius: 12px;
                        padding: 4px;
                        margin: 20px 0;
                    }
                    .progress-bar {
                        height: 30px;
                        background: linear-gradient(90deg, var(--spotify), var(--youtube));
                        border-radius: 8px;
                        transition: width 0.3s ease;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .current-track {
                        background: #2a2a2a;
                        padding: 20px;
                        border-radius: 12px;
                        margin: 20px 0;
                        text-align: center;
                    }
                    .track-name {
                        font-size: 20px;
                        font-weight: 600;
                        color: white;
                        margin-bottom: 8px;
                    }
                    .track-status {
                        font-size: 14px;
                        color: #888;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 15px;
                        margin-top: 20px;
                    }
                    .stat-box {
                        background: #2a2a2a;
                        padding: 15px;
                        border-radius: 12px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 24px;
                        font-weight: bold;
                        color: var(--spotify);
                    }
                    .stat-label {
                        font-size: 12px;
                        color: #888;
                        margin-top: 5px;
                    }
                    .spinner {
                        border: 3px solid #2a2a2a;
                        border-top: 3px solid var(--spotify);
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="container" style="max-width: 700px;">
                    <h1 style="margin-bottom: 10px;">Migrando Playlist</h1>
                    <p style="font-size: 14px; color: #888; margin-bottom: 30px;">Aguarde enquanto transferimos suas musicas...</p>
                    
                    <div class="progress-container">
                        <div class="progress-bar" id="progressBar" style="width: 0%;">0%</div>
                    </div>
                    
                    <div class="current-track">
                        <div class="spinner"></div>
                        <div class="track-name" id="currentTrack">Iniciando migracao...</div>
                        <div class="track-status" id="trackStatus">Preparando...</div>
                    </div>
                    
                    <div class="stats">
                        <div class="stat-box">
                            <div class="stat-value" id="successCount">0</div>
                            <div class="stat-label">Migradas</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="failCount">0</div>
                            <div class="stat-label">Falhas</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value" id="timeRemaining">--</div>
                            <div class="stat-label">Tempo restante</div>
                        </div>
                    </div>
                    
                    <div id="finalResult" style="display: none; margin-top: 30px; text-align: center;">
                        <h2 style="color: var(--spotify);">Migracao Concluida!</h2>
                        <a href="" id="playlistLink" target="_blank" class="button youtube">Abrir no YouTube</a>
                        <a href="/playlists" style="display:block; margin-top:15px; color: #666; text-decoration: none;">Voltar para playlists</a>
                    </div>
                </div>
                <script>
                    let totalTracks = 0;
                    let currentIndex = 0;
                    let successCount = 0;
                    let failCount = 0;
                    let startTime = Date.now();
                    
                    function updateProgress(current, total, trackName, success) {
                        currentIndex = current;
                        totalTracks = total;
                        
                        const percentage = Math.round((current / total) * 100);
                        document.getElementById('progressBar').style.width = percentage + '%';
                        document.getElementById('progressBar').textContent = percentage + '%';
                        
                        document.getElementById('currentTrack').textContent = trackName;
                        document.getElementById('trackStatus').textContent = success ? 'Adicionada com sucesso' : 'Nao encontrada';
                        
                        if (success) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                        
                        document.getElementById('successCount').textContent = successCount;
                        document.getElementById('failCount').textContent = failCount;
                        
                        const elapsed = (Date.now() - startTime) / 1000;
                        const avgTime = elapsed / current;
                        const remaining = Math.round((total - current) * avgTime);
                        const minutes = Math.floor(remaining / 60);
                        const seconds = remaining % 60;
                        document.getElementById('timeRemaining').textContent = minutes + 'm ' + seconds + 's';
                    }
                    
                    function showFinalResult(url) {
                        document.querySelector('.progress-container').style.display = 'none';
                        document.querySelector('.current-track').style.display = 'none';
                        document.getElementById('finalResult').style.display = 'block';
                        document.getElementById('playlistLink').href = url;
                    }
                </script>
            </body>
            </html>
        `);

      const originalLog = console.log;
      let trackCount = 0;
      let totalTracks = 0;

      console.log = (...args: any[]) => {
        const message = args.join(" ");

        if (message.includes("✓ Playlist encontrada:")) {
          const match = message.match(/\((\d+) músicas\)/);
          if (match) {
            totalTracks = parseInt(match[1]);
          }
        }

        if (message.match(/\[\d+\/\d+\]/)) {
          trackCount++;
          const trackMatch = message.match(/\] \((\d+)%\) (.+)/);
          if (trackMatch) {
            const trackName = trackMatch[2];
            const isSuccess = !message.includes("✗");
            res.write(
              `<script>updateProgress(${trackCount}, ${totalTracks}, ${JSON.stringify(
                trackName
              )}, ${isSuccess});</script>`
            );
          }
        }

        originalLog(...args);
      };

      const result = await migrationController.migratePlaylist(
        playlistId,
        privacyStatus
      );

      console.log = originalLog;

      res.write(
        `<script>showFinalResult(${JSON.stringify(
          result.youtubePlaylistUrl
        )});</script>`
      );
      res.end();
    } catch (error: any) {
      res.write(`
                <div id="finalResult" style="display: block; margin-top: 30px; text-align: center;">
                    <h2 style="color: #ff4444; margin-bottom: 20px;">Erro na migracao</h2>
                    <div style="background: #2a2a2a; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: left;">
                        <p style="color: #e0e0e0; line-height: 1.6; margin: 0;">${error.message}</p>
                    </div>
                    <a href="/playlists" class="button">Tentar Novamente</a>
                </div>
                </div>
            </body>
            </html>
        `);
      res.end();
    }
  }
);

// Capturar exceções não tratadas
process.on("uncaughtException", (error) => {
  console.error("❌ Exceção não tratada:", error);
  // Não encerrar o processo
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Promise rejeitada não tratada:", reason);
  // Não encerrar o processo
});

// Prevenir que o processo encerre inesperadamente
process.stdin.resume();

// Iniciar servidor Express
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Servidor rodando na porta ${PORT}                        ║
║   📡 Redis conectado e pronto                              ║
║                                                            ║
║   Interface Web:                                           ║
║   http://localhost:${PORT}                                     ║
║                                                            ║
║   Autenticação:                                            ║
║   GET  /auth/spotify - Conectar Spotify                    ║
║   GET  /auth/youtube - Conectar YouTube                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log("\n💡 Pressione Ctrl+C para encerrar o servidor\n");
});

// Garantir que o servidor não encerre
server.on("error", (error) => {
  console.error("❌ Erro no servidor:", error);
});

// Handler de encerramento gracioso (apenas quando explicitamente solicitado)
let isShuttingDown = false;

process.on("SIGINT", () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n\n🛑 SIGINT recebido - Encerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor HTTP encerrado");
    redisClient.quit(() => {
      console.log("✅ Conexão Redis encerrada");
      process.exit(0);
    });
  });

  // Timeout de segurança
  setTimeout(() => {
    console.log("⚠️ Forçando encerramento...");
    process.exit(1);
  }, 5000);
});

process.on("SIGTERM", () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n\n🛑 SIGTERM recebido - Encerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor HTTP encerrado");
    redisClient.quit(() => {
      console.log("✅ Conexão Redis encerrada");
      process.exit(0);
    });
  });
});
