/**
 * Formata uma query de busca para o YouTube
 * Adiciona termos como "official audio" para melhorar os resultados
 */
export const formatSearchQuery = (
  trackName: string,
  artistName: string
): string => {
  // Remove caracteres especiais que podem atrapalhar a busca
  const cleanTrack = trackName.replace(/[^\w\s]/gi, "").trim();
  const cleanArtist = artistName.replace(/[^\w\s]/gi, "").trim();

  return `${cleanTrack} ${cleanArtist} official audio`;
};

/**
 * Adiciona delay entre requisições para evitar rate limiting
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Formata o tempo decorrido em formato legível
 */
export const formatElapsedTime = (startTime: number): string => {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * Calcula a porcentagem de progresso
 */
export const calculateProgress = (current: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
};

/**
 * Trata erros de API de forma consistente
 */
export const handleApiError = (error: any, context: string): string => {
  if (error.response) {
    // Erro de resposta HTTP
    return `${context}: ${error.response.status} - ${
      error.response.data?.error?.message || error.response.statusText
    }`;
  } else if (error.request) {
    // Erro de requisição (sem resposta)
    return `${context}: Sem resposta do servidor`;
  } else {
    // Outro tipo de erro
    return `${context}: ${error.message}`;
  }
};
