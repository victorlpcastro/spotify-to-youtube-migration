export interface SpotifyTrack {
  name: string;
  artist: string;
  album?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
}

export interface SpotifyTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface YouTubeTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface MigrationResult {
  playlistName: string;
  totalTracks: number;
  successfullyAdded: number;
  failed: number;
  failedTracks: Array<{
    track: string;
    artist: string;
    reason: string;
  }>;
  youtubePlaylistId: string;
  youtubePlaylistUrl: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
