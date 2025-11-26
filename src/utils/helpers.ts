export const formatSearchQuery = (
  trackName: string,
  artistName: string
): string => {
  const cleanTrack = trackName.replace(/[^\w\s]/gi, "").trim();
  const cleanArtist = artistName.replace(/[^\w\s]/gi, "").trim();

  return `${cleanTrack} ${cleanArtist} official audio`;
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const formatElapsedTime = (startTime: number): string => {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

export const calculateProgress = (current: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
};

export const handleApiError = (error: any, context: string): string => {
  if (error.response) {
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
