# 🎵 Spotify to YouTube Playlist Migration App

## 📋 Visão Geral

Aplicação completa para migrar playlists do Spotify para o YouTube de forma automática. O app utiliza OAuth 2.0 para autenticação segura e as APIs oficiais de ambas as plataformas.

## ✨ Funcionalidades

- ✅ Autenticação OAuth 2.0 com Spotify e YouTube
- ✅ Listagem de todas as playlists do usuário no Spotify
- ✅ Criação automática de playlists no YouTube
- ✅ Busca inteligente de músicas no YouTube
- ✅ Migração completa com relatório detalhado
- ✅ Interface web simples e intuitiva
- ✅ Controle de rate limiting (1 segundo entre músicas)
- ✅ Tratamento de erros e músicas não encontradas

## 🛠️ Tecnologias Utilizadas

- **Node.js** + **TypeScript**
- **Express.js** - Framework web
- **Axios** - Cliente HTTP
- **Spotify Web API Node** - SDK oficial do Spotify
- **Google APIs** - SDK oficial do YouTube
- **Dotenv** - Gerenciamento de variáveis de ambiente

## 📦 Pré-requisitos

- Node.js (versão 14 ou superior)
- NPM ou Yarn
- Credenciais das APIs (veja configuração abaixo)

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/victorlpcastro/spotify-to-youtube-migration
cd playlist-migration-app
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

O arquivo `.env` já está configurado com suas credenciais:

```env
# Spotify API Credentials
SPOTIFY_CLIENT_ID=e2587aa02fc747d6825ec65c64ca0697
SPOTIFY_CLIENT_SECRET=<seu_client_secret>
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback

# Google/YouTube API Credentials
GOOGLE_CLIENT_ID=914004421214-l46ukqlf7ugmrfovpb99vhscri3bt630.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<seu_client_secret>
GOOGLE_REDIRECT_URI=http://localhost:8888/google-callback

# Server Configuration
PORT=8888
NODE_ENV=development
```

### 4. Configure os Redirect URIs nas plataformas

**Spotify Developer Dashboard:**

- Acesse https://developer.spotify.com/dashboard
- Vá nas configurações do seu app
- Adicione: `http://localhost:8888/callback`

**Google Cloud Console:**

- Acesse https://console.cloud.google.com
- Vá em "APIs e Serviços" > "Credenciais"
- Edite seu OAuth 2.0 Client ID
- Adicione: `http://localhost:8888/google-callback`

## 🎮 Como Usar

### 1. Inicie o servidor

```bash
npm run dev
```

### 2. Acesse a aplicação

Abra seu navegador e vá para: `http://localhost:8888`

### 3. Conecte suas contas

1. Clique em "🎧 Conectar com Spotify"
2. Autorize o aplicativo
3. Clique em "📺 Conectar com YouTube"
4. Autorize o aplicativo

### 4. Migre suas playlists

1. Clique em "📋 Ver Minhas Playlists"
2. Escolha a playlist que deseja migrar
3. Clique em "🚀 Migrar para YouTube"
4. Aguarde o processo (pode levar alguns minutos)
5. Acesse sua nova playlist no YouTube!

## 📊 Scripts Disponíveis

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Build do projeto
npm run build

# Executar versão compilada
npm start
```

## 🏗️ Estrutura do Projeto

```
playlist-migration-app/
├── src/
│   ├── auth/
│   │   ├── spotify-auth.ts      # Autenticação OAuth do Spotify
│   │   └── youtube-auth.ts      # Autenticação OAuth do YouTube
│   ├── config/
│   │   └── api-config.ts        # Configurações e variáveis de ambiente
│   ├── controllers/
│   │   └── migration-controller.ts  # Lógica principal de migração
│   ├── services/
│   │   ├── spotify-service.ts   # Interação com API do Spotify
│   │   └── youtube-service.ts   # Interação com API do YouTube
│   ├── types/
│   │   └── index.ts             # Definições TypeScript
│   ├── utils/
│   │   └── helpers.ts           # Funções auxiliares
│   └── index.ts                 # Servidor Express
├── .env                         # Variáveis de ambiente (não commitar!)
├── .env.example                 # Exemplo de variáveis
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 Como Funciona

### Fluxo de Migração

1. **Autenticação**

   - Usuário autoriza o app no Spotify
   - Usuário autoriza o app no YouTube
   - Tokens OAuth são armazenados temporariamente

2. **Obtenção das Músicas**

   - Lista playlists do Spotify
   - Extrai informações de cada música (nome, artista)

3. **Criação da Playlist**

   - Cria uma nova playlist no YouTube com mesmo nome

4. **Migração das Músicas**

   - Para cada música:
     - Busca no YouTube: `"{nome} {artista} official audio"`
     - Pega o primeiro resultado
     - Adiciona à playlist do YouTube
     - Aguarda 1 segundo (rate limiting)

5. **Relatório Final**
   - Mostra músicas adicionadas com sucesso
   - Lista músicas que falharam (se houver)
   - Link da playlist criada

## ⚠️ Limitações e Considerações

### Precisão da Busca

- O app busca pelo primeiro resultado no YouTube
- Nem sempre é a versão exata da música
- Pode encontrar versões ao vivo, covers, remixes, etc.

### Cotas da API do YouTube

- **10.000 unidades/dia** (limite gratuito)
- Cada busca = **100 unidades**
- Cada inserção = **50 unidades**
- Uma playlist de 100 músicas = ~15.000 unidades
- **Solução:** Faça migrações em dias diferentes ou solicite aumento de cota

### Taxa de Sucesso

- Depende da disponibilidade das músicas no YouTube
- Músicas regionais ou muito novas podem não ser encontradas
- Podcasts e audiobooks não funcionam

## 🐛 Troubleshooting

### Erro: "Código de autorização não fornecido"

- Verifique se os Redirect URIs estão configurados corretamente
- Certifique-se de usar `http://localhost:8888`

### Erro: "Falha na autenticação"

- Verifique se as credenciais no `.env` estão corretas
- Confirme que as APIs estão ativadas no Google Cloud

### Erro: "Quota exceeded"

- Aguarde 24 horas para reset da cota
- Ou solicite aumento de cota no Google Cloud Console

### Músicas não encontradas

- Normal! Nem toda música do Spotify está no YouTube
- Verifique o relatório final para ver quais falharam

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se livre para:

- Reportar bugs
- Sugerir novas funcionalidades
- Enviar pull requests

## 📝 Licença

MIT License

## 👨‍💻 Autor

Desenvolvido por victorlpcastro

---

**⭐ Se este projeto foi útil, considere dar uma estrela!**
