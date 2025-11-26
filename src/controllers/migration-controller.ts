import { SpotifyService } from "../services/spotify-service";
import { YouTubeService } from "../services/youtube-service";
import { MigrationResult } from "../types";
import { delay, calculateProgress, formatElapsedTime } from "../utils/helpers";

export class MigrationController {
  private spotifyService: SpotifyService;
  private youtubeService: YouTubeService;

  constructor(spotifyService: SpotifyService, youtubeService: YouTubeService) {
    this.spotifyService = spotifyService;
    this.youtubeService = youtubeService;
  }

  public async migratePlaylist(
    spotifyPlaylistId: string,
    privacyStatus: "private" | "public" | "unlisted" = "private"
  ): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      console.log("📋 Buscando playlist do Spotify...");
      const playlistInfo = await this.spotifyService.getPlaylistInfo(
        spotifyPlaylistId
      );
      console.log(
        `✓ Playlist encontrada: "${playlistInfo.name}" (${playlistInfo.trackCount} músicas)`
      );

      const tracks = await this.spotifyService.getPlaylistTracks(
        spotifyPlaylistId
      );
      console.log(`✓ ${tracks.length} músicas carregadas do Spotify\n`);
      console.log("🎵 Criando playlist no YouTube...");
      const youtubePlaylist = await this.youtubeService.createPlaylist(
        playlistInfo.name,
        playlistInfo.description,
        privacyStatus
      );
      console.log(`✓ Playlist criada: ${youtubePlaylist.url}\n`);

      console.log("Iniciando migração das músicas...\n");

      const result: MigrationResult = {
        playlistName: playlistInfo.name,
        totalTracks: tracks.length,
        successfullyAdded: 0,
        failed: 0,
        failedTracks: [],
        youtubePlaylistId: youtubePlaylist.id,
        youtubePlaylistUrl: youtubePlaylist.url,
      };

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const progress = calculateProgress(i + 1, tracks.length);

        console.log(
          `[${i + 1}/${tracks.length}] (${progress}%) ${track.name} - ${
            track.artist
          }`
        );

        try {
          const addResult = await this.youtubeService.searchAndAddToPlaylist(
            youtubePlaylist.id,
            track.name,
            track.artist
          );

          if (addResult.success) {
            result.successfullyAdded++;
            console.log(`  ✓ Adicionado (Video ID: ${addResult.videoId})`);
          } else {
            result.failed++;
            result.failedTracks.push({
              track: track.name,
              artist: track.artist,
              reason: addResult.error || "Erro desconhecido",
            });
            console.log(`  ✗ Falhou: ${addResult.error}`);
          }
        } catch (error: any) {
          result.failed++;
          result.failedTracks.push({
            track: track.name,
            artist: track.artist,
            reason: error.message,
          });
          console.log(`  ✗ Erro: ${error.message}`);
        }

        if (i < tracks.length - 1) {
          await delay(1000); // 1 segundo entre músicas
        }

        console.log("");
      }

      // Resumo final
      const elapsed = formatElapsedTime(startTime);
      console.log("\n" + "=".repeat(60));
      console.log("📊 RESUMO DA MIGRAÇÃO");
      console.log("=".repeat(60));
      console.log(`Playlist: ${result.playlistName}`);
      console.log(`Total de músicas: ${result.totalTracks}`);
      console.log(`✓ Adicionadas com sucesso: ${result.successfullyAdded}`);
      console.log(`✗ Falharam: ${result.failed}`);
      console.log(`Tempo decorrido: ${elapsed}`);
      console.log(`URL da playlist: ${result.youtubePlaylistUrl}`);
      console.log("=".repeat(60));

      if (result.failedTracks.length > 0) {
        console.log("\n⚠️  Músicas que falharam:");
        result.failedTracks.forEach((failed, index) => {
          console.log(`  ${index + 1}. ${failed.track} - ${failed.artist}`);
          console.log(`     Razão: ${failed.reason}`);
        });
      }

      return result;
    } catch (error: any) {
      console.error("\n Erro durante a migração:", error.message);
      throw new Error(`Falha na migração da playlist: ${error.message}`);
    }
  }

  public async listSpotifyPlaylists() {
    try {
      console.log("📋 Buscando playlists do Spotify...\n");
      const playlists = await this.spotifyService.getUserPlaylists();

      console.log(`Encontradas ${playlists.length} playlists:\n`);
      playlists.forEach((playlist, index) => {
        console.log(`${index + 1}. ${playlist.name}`);
        console.log(`   ID: ${playlist.id}`);
        console.log(`   Músicas: ${playlist.trackCount}`);
        if (playlist.description) {
          console.log(`   Descrição: ${playlist.description}`);
        }
        console.log("");
      });

      return playlists;
    } catch (error: any) {
      throw error;
    }
  }
}
