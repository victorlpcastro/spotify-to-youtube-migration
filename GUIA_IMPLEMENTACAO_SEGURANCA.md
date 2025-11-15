# 🛡️ Guia Passo a Passo: Implementação de Segurança

## 📋 Índice

1. [Implementar Sistema de Sessões (Redis)](#1-implementar-sistema-de-sessões-redis)
2. [Adicionar Validação de Input](#2-adicionar-validação-de-input)
3. [Implementar CSRF Protection](#3-implementar-csrf-protection)
4. [Adicionar Rate Limiting](#4-adicionar-rate-limiting)
5. [Configurar Headers de Segurança (Helmet)](#5-configurar-headers-de-segurança-helmet)
6. [Adicionar Sanitização de Input](#6-adicionar-sanitização-de-input)
7. [Configurar HTTPS em Produção](#7-configurar-https-em-produção)

---

## 1. Implementar Sistema de Sessões (Redis)

### Por que é importante?

- Tokens não serão perdidos ao reiniciar o servidor
- Suporta múltiplos usuários simultaneamente
- Mais seguro que armazenar em memória

### Passo 1.1: Instalar dependências

```bash
npm install express-session connect-redis redis
npm install --save-dev @types/express-session
```

### Passo 1.2: Criar arquivo de configuração de sessão

Crie o arquivo `src/config/session-config.ts`:

```typescript
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";

// Criar cliente Redis
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

// Conectar ao Redis
redisClient.connect().catch(console.error);

// Configurar store Redis
const store = new RedisStore({
  client: redisClient,
  prefix: "spotify-yt-session:",
  ttl: 86400, // 24 horas
});

// Exportar configuração de sessão
export const sessionConfig: session.SessionOptions = {
  store,
  secret: process.env.SESSION_SECRET || "MUDE-ISSO-EM-PRODUCAO",
  resave: false,
  saveUninitialized: false,
  name: "sessionId", // Nome do cookie customizado
  cookie: {
    secure: process.env.NODE_ENV === "production", // HTTPS em produção
    httpOnly: true, // Previne acesso via JavaScript
    maxAge: 1000 * 60 * 60 * 24, // 24 horas
    sameSite: "lax", // Proteção adicional contra CSRF
  },
};
```

### Passo 1.3: Atualizar tipos TypeScript

Crie o arquivo `src/types/session.d.ts`:

```typescript
import "express-session";
import { SpotifyTokens, YouTubeTokens } from "./index";

declare module "express-session" {
  interface SessionData {
    spotifyTokens?: SpotifyTokens;
    youtubeTokens?: YouTubeTokens;
    userId?: string;
  }
}
```

### Passo 1.4: Atualizar `src/index.ts`

Substitua:

```typescript
// REMOVER ISSO:
const userTokens: {
  spotify?: SpotifyTokens;
  youtube?: YouTubeTokens;
} = {};
```

Por:

```typescript
import session from "express-session";
import { sessionConfig } from "./config/session-config";

// Adicionar middleware de sessão
app.use(session(sessionConfig));
```

E substitua todas as referências a `userTokens` por `req.session`:

```typescript
// ANTES:
userTokens.spotify = tokens;

// DEPOIS:
req.session.spotifyTokens = tokens;

// ANTES:
if (!userTokens.spotify || !userTokens.youtube) {
  // ...
}

// DEPOIS:
if (!req.session.spotifyTokens || !req.session.youtubeTokens) {
  // ...
}
```

### Passo 1.5: Instalar Redis localmente (desenvolvimento)

**Windows:**

```bash
# Via Chocolatey
choco install redis-64

# Ou baixe o instalador:
# https://github.com/microsoftarchive/redis/releases
```

**Para produção:** Use Redis Cloud (gratuito até 30MB)

- https://redis.com/try-free/

---

## 2. Adicionar Validação de Input

### Passo 2.1: Instalar Joi

```bash
npm install joi
npm install --save-dev @types/joi
```

### Passo 2.2: Criar schemas de validação

Crie o arquivo `src/validators/schemas.ts`:

```typescript
import Joi from "joi";

export const playlistIdSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9_-]+$/)
  .min(10)
  .max(100)
  .required()
  .messages({
    "string.pattern.base": "Playlist ID inválido",
    "string.min": "Playlist ID muito curto",
    "string.max": "Playlist ID muito longo",
    "any.required": "Playlist ID é obrigatório",
  });

export const authCodeSchema = Joi.string()
  .min(10)
  .max(500)
  .required()
  .messages({
    "string.min": "Código de autorização inválido",
    "any.required": "Código de autorização é obrigatório",
  });

export const privacyStatusSchema = Joi.string()
  .valid("private", "public", "unlisted")
  .default("private");
```

### Passo 2.3: Criar middleware de validação

Crie o arquivo `src/middleware/validate.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const validate = (
  schema: Joi.Schema,
  property: "body" | "params" | "query"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    req[property] = value;
    next();
  };
};
```

### Passo 2.4: Aplicar validação nas rotas

Em `src/index.ts`:

```typescript
import { validate } from "./middleware/validate";
import { playlistIdSchema, authCodeSchema } from "./validators/schemas";

// Validar callback do Spotify
app.get("/callback", validate(authCodeSchema, "query"), async (req, res) => {
  const code = req.query.code as string;
  // ... resto do código
});

// Validar migração de playlist
app.get(
  "/migrate/:playlistId",
  validate(playlistIdSchema, "params"),
  async (req, res) => {
    const { playlistId } = req.params;
    // ... resto do código
  }
);
```

---

## 3. Implementar CSRF Protection

### Passo 3.1: Instalar dependências

```bash
npm install csurf cookie-parser
npm install --save-dev @types/cookie-parser
```

### Passo 3.2: Configurar em `src/index.ts`

```typescript
import cookieParser from "cookie-parser";
import csrf from "csurf";

// Adicionar ANTES das rotas
app.use(cookieParser());

// Configurar CSRF (apenas para rotas que modificam dados)
const csrfProtection = csrf({ cookie: true });

// Aplicar em rotas específicas
app.get("/", csrfProtection, (req, res) => {
  // Passar token CSRF para o HTML
  res.send(`
    <html>
      <head>
        <meta name="csrf-token" content="${req.csrfToken()}">
      </head>
      <body>
        <!-- ... resto do HTML -->
      </body>
    </html>
  `);
});
```

---

## 4. Adicionar Rate Limiting

### Passo 4.1: Instalar

```bash
npm install express-rate-limit
```

### Passo 4.2: Configurar limitadores

Crie o arquivo `src/middleware/rate-limit.ts`:

```typescript
import rateLimit from "express-rate-limit";

// Limitador geral
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: "Muitas requisições, tente novamente em 15 minutos",
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador para autenticação
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 tentativas
  message: "Muitas tentativas de login, tente novamente em 1 hora",
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
});

// Limitador para migração (mais restritivo)
export const migrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 migrações por hora
  message: "Você atingiu o limite de migrações. Aguarde 1 hora.",
});
```

### Passo 4.3: Aplicar nas rotas

Em `src/index.ts`:

```typescript
import {
  generalLimiter,
  authLimiter,
  migrationLimiter,
} from "./middleware/rate-limit";

// Aplicar limitador geral em todas as rotas
app.use(generalLimiter);

// Aplicar limitadores específicos
app.get("/auth/spotify", authLimiter, (req, res) => {
  /* ... */
});
app.get("/auth/youtube", authLimiter, (req, res) => {
  /* ... */
});
app.get("/migrate/:playlistId", migrationLimiter, async (req, res) => {
  /* ... */
});
```

---

## 5. Configurar Headers de Segurança (Helmet)

### Passo 5.1: Instalar

```bash
npm install helmet
```

### Passo 5.2: Configurar em `src/index.ts`

```typescript
import helmet from "helmet";

// Adicionar ANTES de outras rotas
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

## 6. Adicionar Sanitização de Input

### Passo 6.1: Instalar

```bash
npm install express-mongo-sanitize xss-clean
```

### Passo 6.2: Configurar em `src/index.ts`

```typescript
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";

// Adicionar após body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Previne NoSQL injection
app.use(mongoSanitize());

// Previne XSS
app.use(xss());
```

---

## 7. Configurar HTTPS em Produção

### Passo 7.1: Forçar HTTPS

Adicione em `src/index.ts`:

```typescript
// Forçar HTTPS em produção
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      return res.redirect(`https://${req.header("host")}${req.url}`);
    }
    next();
  });
}
```

### Passo 7.2: Atualizar configuração de cookies

Em `src/config/session-config.ts`:

```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production', // Já configurado!
  httpOnly: true,
  maxAge: 1000 * 60 * 60 * 24,
  sameSite: 'lax'
}
```

---

## 📋 Checklist Final de Implementação

### Desenvolvimento Local

- [ ] Redis instalado e rodando
- [ ] Testar sessões funcionando
- [ ] Testar validação com inputs inválidos
- [ ] Testar rate limiting

### Antes do Deploy

- [ ] Todas as melhorias implementadas
- [ ] `.env` não está no Git
- [ ] `.gitignore` configurado
- [ ] Testes realizados
- [ ] `npm audit` executado e corrigido

### Configuração do Servidor de Produção

- [ ] Redis Cloud configurado
- [ ] Variáveis de ambiente definidas:
  - `SESSION_SECRET` (use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - `REDIS_URL`
  - `NODE_ENV=production`
- [ ] HTTPS configurado (automático no Render/Vercel)
- [ ] Logs de produção configurados
- [ ] Monitoramento ativo

---

## 🔧 Comandos Úteis

### Gerar SESSION_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Testar Redis localmente:

```bash
redis-cli ping
# Deve retornar: PONG
```

### Verificar vulnerabilidades:

```bash
npm audit
npm audit fix
```

### Atualizar dependências:

```bash
npm update
npm outdated
```

---

## 📚 Recursos Adicionais

- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Redis Cloud (Free Tier)](https://redis.com/try-free/)

---

## ⏱️ Estimativa de Tempo

| Tarefa             | Tempo Estimado |
| ------------------ | -------------- |
| Sessões com Redis  | 30-45 min      |
| Validação de Input | 20-30 min      |
| CSRF Protection    | 15-20 min      |
| Rate Limiting      | 10-15 min      |
| Helmet             | 5 min          |
| Sanitização        | 5 min          |
| Testes             | 30 min         |
| **TOTAL**          | **~2-3 horas** |

---

## 🆘 Troubleshooting

### Redis não conecta:

```bash
# Windows - iniciar Redis
redis-server

# Verificar se está rodando
redis-cli ping
```

### Erro de sessão:

- Verifique se `SESSION_SECRET` está definido
- Confirme que Redis está rodando
- Limpe o cache do navegador

### Rate limit muito restritivo:

Ajuste os valores em `src/middleware/rate-limit.ts`

---

**Implementado por:** [Seu Nome]  
**Data:** 14 de Novembro de 2025  
**Versão:** 1.0
