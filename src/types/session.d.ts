import { SpotifyTokens, YouTubeTokens } from "./index";

declare module "express-session" {
  interface SessionData {
    spotifyTokens?: SpotifyTokens;
    youtubeTokens?: YouTubeTokens;
  }
}
