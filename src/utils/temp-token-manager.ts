import { randomBytes } from "crypto";

/**
 * Armazenamento temporário de tokens durante o fluxo OAuth
 * Para resolver o problema de perda de sessão entre redirecionamentos
 */

interface TempTokenStorage {
  spotifyTokens?: any;
  youtubeTokens?: any;
  timestamp: number;
}

// Map para armazenar temporariamente os tokens durante OAuth flow
const tempStorage = new Map<string, TempTokenStorage>();

// Limpar entradas antigas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000; // 10 minutos

  for (const [key, value] of tempStorage.entries()) {
    if (now - value.timestamp > expireTime) {
      tempStorage.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class TempTokenManager {
  /**
   * Gera um código único para rastrear a sessão durante OAuth
   */
  static generateStateCode(): string {
    return randomBytes(16).toString("hex");
  }

  /**
   * Salva tokens temporariamente usando um código
   */
  static saveTokens(
    stateCode: string,
    spotifyTokens?: any,
    youtubeTokens?: any
  ): void {
    const existing = tempStorage.get(stateCode) || { timestamp: Date.now() };

    if (spotifyTokens) {
      existing.spotifyTokens = spotifyTokens;
    }

    if (youtubeTokens) {
      existing.youtubeTokens = youtubeTokens;
    }

    existing.timestamp = Date.now();
    tempStorage.set(stateCode, existing);

    console.log(`💾 Tokens salvos temporariamente com código: ${stateCode}`);
  }

  /**
   * Recupera tokens usando o código
   */
  static getTokens(stateCode: string): TempTokenStorage | null {
    const tokens = tempStorage.get(stateCode);

    if (!tokens) {
      console.log(`⚠️ Nenhum token encontrado para código: ${stateCode}`);
      return null;
    }

    console.log(`📥 Tokens recuperados para código: ${stateCode}`);
    return tokens;
  }

  /**
   * Remove tokens após uso bem-sucedido
   */
  static clearTokens(stateCode: string): void {
    tempStorage.delete(stateCode);
    console.log(`🗑️ Tokens temporários removidos para código: ${stateCode}`);
  }
}
