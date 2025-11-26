import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} from "../config/api-config";
import { YouTubeTokens } from "../types";

export const createOAuth2Client = (): OAuth2Client => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
};

export const getYouTubeAuthUrl = (state?: string): string => {
  const oauth2Client = createOAuth2Client();

  const scopes = ["https://www.googleapis.com/auth/youtube.force-ssl"];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: state || "",
  });

  console.log("🔗 YouTube Auth URL gerada:", authUrl);
  console.log("📋 Redirect URI configurado:", GOOGLE_REDIRECT_URI);

  return authUrl;
};

export const exchangeYouTubeCodeForToken = async (
  code: string
): Promise<YouTubeTokens> => {
  try {
    console.log("🔄 Tentando trocar código do YouTube por token...");
    console.log("📝 Código recebido:", code.substring(0, 20) + "...");
    console.log("🔑 Client ID:", GOOGLE_CLIENT_ID.substring(0, 20) + "...");
    console.log("🔙 Redirect URI:", GOOGLE_REDIRECT_URI);

    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    console.log("✅ Tokens recebidos com sucesso!");
    console.log("🎫 Access token presente:", !!tokens.access_token);
    console.log("🔄 Refresh token presente:", !!tokens.refresh_token);
    // ⚠️ NUNCA logue tokens completos em produção!

    return tokens as YouTubeTokens;
  } catch (error: any) {
    throw new Error(`Falha na autenticação do YouTube: ${error.message}`);
  }
};

export const getAuthenticatedClient = (tokens: YouTubeTokens): OAuth2Client => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
};
