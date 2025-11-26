import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { YOUTUBE_API_KEY } from "../config/api-config";

export class YouTubeService {
  private youtube: youtube_v3.Youtube;
  private oauth2Client: OAuth2Client;
  private youtubeWithApiKey: youtube_v3.Youtube;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });
    // Cliente separado com API Key para buscas (quota maior)
    this.youtubeWithApiKey = google.youtube({
      version: "v3",
      auth: YOUTUBE_API_KEY,
    });

    if (YOUTUBE_API_KEY) {
      console.log("YouTube API Key configurada - Buscas usarao a API Key");
    } else {
      console.log(
        "AVISO: YouTube API Key nao encontrada - Buscas usarao OAuth"
      );
    }
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
      console.error("Erro ao criar playlist no YouTube:", error.message);
      console.error("Status do erro:", error.response?.status);

      // Verificar se é erro de quota
      if (error.response?.status === 403 && error.message.includes("quota")) {
        throw new Error(
          "Quota do YouTube API excedida. A API Key e usada apenas para buscas. " +
            "Para criar playlists e adicionar videos, e necessario OAuth, que tem quota diaria limitada (10.000 unidades/dia). " +
            "Cada playlist criada custa 50 unidades, cada video adicionado custa 50 unidades. " +
            "A quota reseta a meia-noite (Horario do Pacifico). " +
            "Solucao: Aguarde ate amanha ou use outra conta OAuth do Google."
        );
      }

      throw new Error(`Falha ao criar playlist no YouTube: ${error.message}`);
    }
  }

  async searchVideo(query: string): Promise<string | null> {
    try {
      // Usar API Key para buscas (quota maior e mais eficiente)
      console.log(`[API Key] Buscando: ${query.substring(0, 50)}...`);
      const response = await this.youtubeWithApiKey.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        maxResults: 1,
        videoCategoryId: "10", // Categoria "Music"
      });

      const items = response.data?.items;
      if (items && items.length > 0 && items[0].id?.videoId) {
        console.log(`[API Key] Video encontrado: ${items[0].id.videoId}`);
        return items[0].id.videoId;
      }

      return null;
    } catch (error: any) {
      console.log(`[API Key] Erro na busca, tentando fallback com OAuth...`);
      // Se falhar com API Key, tentar com OAuth como fallback
      try {
        const fallbackResponse = await this.youtube.search.list({
          part: ["snippet"],
          q: query,
          type: ["video"],
          maxResults: 1,
          videoCategoryId: "10",
        });

        const fallbackItems = fallbackResponse.data?.items;
        if (
          fallbackItems &&
          fallbackItems.length > 0 &&
          fallbackItems[0].id?.videoId
        ) {
          return fallbackItems[0].id.videoId;
        }
      } catch (fallbackError: any) {
        console.error(
          "Erro na busca (API Key e OAuth):",
          fallbackError.message
        );
      }
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
