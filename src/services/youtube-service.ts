import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export class YouTubeService {
  private youtube: youtube_v3.Youtube;
  private oauth2Client: OAuth2Client;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });
  }

  async createPlaylist(
    title: string,
    description: string = "",
    privacyStatus: "private" | "public" | "unlisted" = "private"
  ): Promise<{ id: string; url: string }> {
    try {
      const response = await this.youtube.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description: description || `Playlist migrada do Spotify: ${title}`,
          },
          status: {
            privacyStatus,
          },
        },
      });

      const playlistId = response.data?.id!;
      return {
        id: playlistId,
        url: `https://www.youtube.com/playlist?list=${playlistId}`,
      };
    } catch (error: any) {
      console.error("❌ Erro ao criar playlist no YouTube:", error.message);
      console.error("📊 Status do erro:", error.response?.status);
      console.error(
        "📋 Dados do erro:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error(
        "🔑 Token presente:",
        !!this.oauth2Client.credentials.access_token
      );
      // ⚠️ REMOVIDO: Não logue credenciais completas por segurança
      throw new Error(`Falha ao criar playlist no YouTube: ${error.message}`);
    }
  }

  async searchVideo(query: string): Promise<string | null> {
    try {
      const response = await this.youtube.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults: 1,
        videoCategoryId: "10", // Categoria "Music"
      });

      const items = response.data?.items;
      if (items && items.length > 0 && items[0].id?.videoId) {
        return items[0].id.videoId;
      }

      return null;
    } catch (error: any) {
      console.error(`Erro ao buscar vídeo "${query}":`, error.message);
      return null;
    }
  }

  async addVideoToPlaylist(
    playlistId: string,
    videoId: string
  ): Promise<boolean> {
    try {
      await this.youtube.playlistItems.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId,
            },
          },
        },
      });

      return true;
    } catch (error: any) {
      // Erro específico quando o vídeo não pode ser adicionado
      if (error.code === 403 || error.message.includes("forbidden")) {
        console.error(
          `Vídeo ${videoId} não pode ser adicionado (pode estar bloqueado)`
        );
      } else {
        console.error(`Erro ao adicionar vídeo ${videoId}:`, error.message);
      }
      return false;
    }
  }

  async searchAndAddToPlaylist(
    playlistId: string,
    trackName: string,
    artistName: string
  ): Promise<{ success: boolean; videoId?: string; error?: string }> {
    try {
      const query = `${trackName} ${artistName} official audio`;

      const videoId = await this.searchVideo(query);

      if (!videoId) {
        return {
          success: false,
          error: "Vídeo não encontrado no YouTube",
        };
      }

      const added = await this.addVideoToPlaylist(playlistId, videoId);

      if (!added) {
        return {
          success: false,
          videoId,
          error: "Falha ao adicionar vídeo à playlist",
        };
      }

      return {
        success: true,
        videoId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
