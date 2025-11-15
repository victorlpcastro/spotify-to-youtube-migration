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

app.get("/", (req: Request, res: Response) => {
  res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Spotify to YouTube Playlist Migration</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #1DB954; }
                .button {
                    display: inline-block;
                    padding: 15px 30px;
                    margin: 10px;
                    background-color: #1DB954;
                    color: white;
                    text-decoration: none;
                    border-radius: 25px;
                    font-weight: bold;
                    transition: background-color 0.3s;
                }
                .button:hover { background-color: #1ed760; }
                .button.youtube { background-color: #FF0000; }
                .button.youtube:hover { background-color: #cc0000; }
                .status {
                    margin-top: 20px;
                    padding: 15px;
                    border-radius: 5px;
                    background-color: #e8f5e9;
                }
                .warning {
                    background-color: #fff3cd;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎵 Spotify to YouTube Playlist Migration</h1>
                <p>Migre suas playlists do Spotify para o YouTube facilmente!</p>
                
                <div class="warning">
                    <strong>⚠️ Importante:</strong> Você precisa autorizar ambas as contas antes de migrar.
                </div>
                
                <h2>Passo 1: Conectar Spotify</h2>
                <a href="/auth/spotify" class="button">🎧 Conectar com Spotify</a>
                
                <h2>Passo 2: Conectar YouTube</h2>
                <a href="/auth/youtube" class="button youtube">📺 Conectar com YouTube</a>
                
                <div class="status">
                    <h3>Status:</h3>
                    <p>Spotify: ${
                      userTokens.spotify ? "✅ Conectado" : "❌ Não conectado"
                    }</p>
                    <p>YouTube: ${
                      userTokens.youtube ? "✅ Conectado" : "❌ Não conectado"
                    }</p>
                </div>
                
                ${
                  userTokens.spotify && userTokens.youtube
                    ? `
                    <h2>Passo 3: Migrar Playlist</h2>
                    <a href="/playlists" class="button">📋 Ver Minhas Playlists</a>
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

  if (!code) {
    return res.status(400).send("Código de autorização não fornecido");
  }

  try {
    const tokens = await exchangeSpotifyCodeForToken(code);
    userTokens.spotify = tokens;

    res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Spotify Conectado</title>
                <meta http-equiv="refresh" content="3;url=/" />
            </head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>✅ Spotify conectado com sucesso!</h1>
                <p>Redirecionando...</p>
            </body>
            </html>
        `);
  } catch (error: any) {
    res.status(500).send(`Erro ao conectar Spotify: ${error.message}`);
  }
});

app.get("/auth/youtube", (req: Request, res: Response) => {
  const authUrl = getYouTubeAuthUrl();
  res.redirect(authUrl);
});

app.get("/google-callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("Código de autorização não fornecido");
  }

  try {
    const tokens = await exchangeYouTubeCodeForToken(code);
    userTokens.youtube = tokens;

    res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>YouTube Conectado</title>
                <meta http-equiv="refresh" content="3;url=/" />
            </head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>✅ YouTube conectado com sucesso!</h1>
                <p>Redirecionando...</p>
            </body>
            </html>
        `);
  } catch (error: any) {
    res.status(500).send(`Erro ao conectar YouTube: ${error.message}`);
  }
});

app.get("/playlists", async (req: Request, res: Response) => {
  if (!userTokens.spotify) {
    return res
      .status(401)
      .send('Spotify não conectado. <a href="/auth/spotify">Conectar</a>');
  }

  try {
    const spotifyService = new SpotifyService(userTokens.spotify.access_token);
    const playlists = await spotifyService.getUserPlaylists();

    let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Minhas Playlists</title>
                <style>
                    body { font-family: Arial; max-width: 900px; margin: 20px auto; padding: 20px; }
                    .playlist {
                        border: 1px solid #ddd;
                        padding: 15px;
                        margin: 10px 0;
                        border-radius: 5px;
                        background: #f9f9f9;
                    }
                    .button {
                        background: #1DB954;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        display: inline-block;
                        margin-top: 10px;
                    }
                    .button:hover { background: #1ed760; }
                </style>
            </head>
            <body>
                <h1>🎵 Suas Playlists do Spotify</h1>
                <p><a href="/">← Voltar</a></p>
        `;

    playlists.forEach((playlist) => {
      html += `
                <div class="playlist">
                    <h3>${playlist.name}</h3>
                    <p>${playlist.description || "Sem descrição"}</p>
                    <p><strong>Músicas:</strong> ${playlist.trackCount}</p>
                    <a href="/migrate/${
                      playlist.id
                    }" class="button">🚀 Migrar para YouTube</a>
                </div>
            `;
    });

    html += `
            </body>
            </html>
        `;

    res.send(html);
  } catch (error: any) {
    res.status(500).send(`Erro: ${error.message}`);
  }
});

app.get("/migrate/:playlistId", async (req: Request, res: Response) => {
  if (!userTokens.spotify || !userTokens.youtube) {
    return res
      .status(401)
      .send('Você precisa conectar ambas as contas. <a href="/">Voltar</a>');
  }

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

    res.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Migrando Playlist</title>
                <style>
                    body { font-family: Arial; max-width: 900px; margin: 20px auto; padding: 20px; }
                    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
                </style>
            </head>
            <body>
                <h1>🚀 Migrando Playlist...</h1>
                <p>Isso pode levar alguns minutos. Não feche esta página.</p>
                <pre>
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

    // Restaura console.log
    console.log = originalLog;

    res.write(`
                </pre>
                <h2>✅ Migração Concluída!</h2>
                <p><a href="${result.youtubePlaylistUrl}" target="_blank">🎵 Abrir Playlist no YouTube</a></p>
                <p><a href="/playlists">← Voltar para Playlists</a></p>
            </body>
            </html>
        `);
    res.end();
  } catch (error: any) {
    res.write(`
                </pre>
                <h2>❌ Erro na Migração</h2>
                <p>${error.message}</p>
                <p><a href="/playlists">← Voltar</a></p>
            </body>
            </html>
        `);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("🎵 Spotify to YouTube Playlist Migration App");
  console.log("=".repeat(60));
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📋 Acesse http://localhost:${PORT} para começar`);
  console.log("=".repeat(60));
});
