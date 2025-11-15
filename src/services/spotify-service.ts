import axios from "axios";
import { Playlist, SpotifyTrack } from "../types";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";

export class SpotifyService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getUserPlaylists(): Promise<Playlist[]> {
    try {
      const response = await axios.get(`${SPOTIFY_API_BASE_URL}/me/playlists`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          limit: 50,
        },
      });

      return response.data.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || "",
        trackCount: item.tracks.total,
      }));
    } catch (error: any) {
      console.error(
        "Erro ao buscar playlists do Spotify:",
        error.response?.data || error.message
      );
      throw new Error("Falha ao buscar playlists do Spotify");
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    try {
      const tracks: SpotifyTrack[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get(
          `${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            params: {
              limit,
              offset,
              fields: "items(track(name,artists(name),album(name))),next",
            },
          }
        );

        const items = response.data.items;

        items.forEach((item: any) => {
          if (item.track && item.track.name) {
            tracks.push({
              name: item.track.name,
              artist: item.track.artists[0]?.name || "Unknown Artist",
              album: item.track.album?.name,
            });
          }
        });

        hasMore = response.data.next !== null;
        offset += limit;
      }

      return tracks;
    } catch (error: any) {
      console.error(
        "Erro ao buscar músicas da playlist:",
        error.response?.data || error.message
      );
      throw new Error("Falha ao buscar músicas da playlist do Spotify");
    }
  }

  async getPlaylistInfo(playlistId: string): Promise<Playlist> {
    try {
      const response = await axios.get(
        `${SPOTIFY_API_BASE_URL}/playlists/${playlistId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            fields: "id,name,description,tracks(total)",
          },
        }
      );

      return {
        id: response.data.id,
        name: response.data.name,
        description: response.data.description || "",
        trackCount: response.data.tracks.total,
      };
    } catch (error: any) {
      console.error(
        "Erro ao buscar informações da playlist:",
        error.response?.data || error.message
      );
      throw new Error("Falha ao buscar informações da playlist");
    }
  }
}
