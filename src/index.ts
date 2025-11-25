import express, { Request, Response } from "express";
import { PORT } from "./config/api-config";
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

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const userTokens: {
  spotify?: SpotifyTokens;
  youtube?: YouTubeTokens;
} = {};

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
                          userTokens.spotify
                            ? '<b class="connected">● Conectado</b>'
                            : '<b class="disconnected">○ Pendente</b>'
                        }
                    </div>
                    <div class="status-item">
                        <span>YouTube</span>
                        ${
                          userTokens.youtube
                            ? '<b class="connected">● Conectado</b>'
                            : '<b class="disconnected">○ Pendente</b>'
                        }
                    </div>
                </div>

                ${
                  !userTokens.spotify
                    ? `<a href="/auth/spotify" class="button spotify">Conectar Spotify</a>`
                    : ""
                }
                
                ${
                  !userTokens.youtube
                    ? `<a href="/auth/youtube" class="button youtube">Conectar YouTube</a>`
                    : ""
                }

                ${
                  userTokens.spotify && userTokens.youtube
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

app.get("/auth/spotify", (req: Request, res: Response) => {
  const authUrl = getSpotifyAuthUrl();
  res.redirect(authUrl);
});

app.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Código não fornecido");

  try {
    const tokens = await exchangeSpotifyCodeForToken(code);
    userTokens.spotify = tokens;

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
                    <h1 style="color: var(--spotify); font-size: 40px;">✓</h1>
                    <h1>Spotify Conectado</h1>
                    <p>Redirecionando...</p>
                </div>
            </body>
            </html>
        `);
  } catch (error: any) {
    res.status(500).send(`Erro: ${error.message}`);
  }
});

app.get("/auth/youtube", (req: Request, res: Response) => {
  const authUrl = getYouTubeAuthUrl();
  res.redirect(authUrl);
});

app.get("/google-callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Código não fornecido");

  try {
    const tokens = await exchangeYouTubeCodeForToken(code);
    userTokens.youtube = tokens;

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
                    <h1 style="color: var(--youtube); font-size: 40px;">✓</h1>
                    <h1>YouTube Conectado</h1>
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
  if (!userTokens.spotify) return res.redirect("/");

  try {
    const spotifyService = new SpotifyService(userTokens.spotify.access_token);
    const playlists = await spotifyService.getUserPlaylists();

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
                        <a href="/" style="color: #666; text-decoration: none; font-size: 14px;">✕ Fechar</a>
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

app.get("/migrate/:playlistId", async (req: Request, res: Response) => {
  if (!userTokens.spotify || !userTokens.youtube) return res.redirect("/");

  const { playlistId } = req.params;
  const privacyStatus =
    (req.query.privacy as "private" | "public" | "unlisted") || "private";

  try {
    const spotifyService = new SpotifyService(userTokens.spotify.access_token);
    const youtubeClient = getAuthenticatedClient(userTokens.youtube);
    const youtubeService = new YouTubeService(youtubeClient);
    const migrationController = new MigrationController(
      spotifyService,
      youtubeService
    );

    // Initial HTML setup with streaming log style
    res.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Processando...</title>
                ${globalStyles}
            </head>
            <body>
                <div class="container">
                    <h1 style="margin-bottom: 20px;">Transferindo...</h1>
                    <p style="font-size: 14px; margin-bottom: 20px;">Não feche esta janela.</p>
                    <pre id="logs">
        `);

    const originalLog = console.log;
    console.log = (...args: any[]) => {
      const message = args.join(" ") + "\n";
      res.write(message);
      originalLog(...args);
    };

    const result = await migrationController.migratePlaylist(
      playlistId,
      privacyStatus
    );

    console.log = originalLog;

    res.write(`
                    </pre>
                    <div style="margin-top: 30px;">
                        <h2 style="color: var(--spotify);">Sucesso!</h2>
                        <a href="${result.youtubePlaylistUrl}" target="_blank" class="button youtube">Abrir no YouTube</a>
                        <a href="/playlists" style="display:block; margin-top:15px; color: #666; text-decoration: none;">Voltar</a>
                    </div>
                </div>
                <script>
                    // Auto-scroll logs
                    const logContainer = document.getElementById('logs');
                    setInterval(() => {
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }, 100);
                </script>
            </body>
            </html>
        `);
    res.end();
  } catch (error: any) {
    res.write(`
                    </pre>
                    <h2 style="color: #ff4444;">Erro</h2>
                    <p>${error.message}</p>
                    <a href="/playlists" class="button">Tentar Novamente</a>
                </div>
            </body>
            </html>
        `);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
