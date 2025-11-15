# 🚀 Guia Rápido de Uso

## ⚡ Start Rápido

### 1. Inicie o servidor

```bash
npm run dev
```

### 2. Abra no navegador

```
http://localhost:8888
```

### 3. Siga os passos na interface

1. Conectar Spotify ✅
2. Conectar YouTube ✅
3. Ver Playlists 📋
4. Migrar! 🚀

---

## 🎯 Endpoints da API

### Autenticação

- `GET /` - Página inicial
- `GET /auth/spotify` - Inicia auth Spotify
- `GET /callback` - Callback Spotify
- `GET /auth/youtube` - Inicia auth YouTube
- `GET /google-callback` - Callback YouTube

### Playlists

- `GET /playlists` - Lista playlists do Spotify
- `GET /migrate/:playlistId` - Migra uma playlist

---

## 📝 Notas Importantes

### ⚠️ Antes de Usar

1. ✅ Credenciais configuradas no `.env`
2. ✅ Redirect URIs adicionados nas plataformas
3. ✅ APIs ativadas (YouTube Data API v3)

### ⏱️ Tempo de Migração

- **Playlist pequena (10-20 músicas):** ~30 segundos
- **Playlist média (50 músicas):** ~2 minutos
- **Playlist grande (100+ músicas):** ~5-10 minutos

### 💡 Dicas

- Use playlists menores primeiro para testar
- Monitore a cota da API do YouTube
- Músicas não encontradas são normais (5-15%)
- Sempre verifique o relatório final

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento com auto-reload
npm run dev

# Build para produção
npm run build

# Executar build
npm start

# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install
```

---

## 🐛 Resolvendo Problemas Comuns

### Problema: Servidor não inicia

```bash
# Verifique se a porta 8888 está livre
netstat -ano | findstr :8888

# Ou mude a porta no .env
PORT=3000
```

### Problema: Erro de autenticação

```bash
# Verifique o .env
cat .env

# Recarregue as variáveis
npm run dev
```

### Problema: Músicas não encontradas

- Normal! Nem tudo está no YouTube
- Tente buscar manualmente depois
- Verifique o relatório de falhas

---

## 📊 Exemplo de Uso pelo Terminal

Se preferir usar programaticamente:

```typescript
import { SpotifyService } from "./services/spotify-service";
import { YouTubeService } from "./services/youtube-service";
import { MigrationController } from "./controllers/migration-controller";

// Seus tokens aqui
const spotifyToken = "seu_token_spotify";
const youtubeClient = getAuthenticatedClient(youtubeTokens);

// Inicializa serviços
const spotifyService = new SpotifyService(spotifyToken);
const youtubeService = new YouTubeService(youtubeClient);
const controller = new MigrationController(spotifyService, youtubeService);

// Lista playlists
const playlists = await controller.listSpotifyPlaylists();

// Migra uma playlist
const result = await controller.migratePlaylist("playlist_id", "private");
console.log(result);
```

---

## 🎉 Pronto!

Seu app está configurado e pronto para usar.

**Próximos passos:**

1. Teste com uma playlist pequena primeiro
2. Verifique se as músicas foram adicionadas corretamente
3. Ajuste as configurações conforme necessário

**Dúvidas?** Consulte o README.md completo!
