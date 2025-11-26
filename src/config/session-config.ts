import session from "express-session";
import { createClient, RedisClient } from "redis";
import connectRedis from "connect-redis";

const RedisStore = connectRedis(session);

export const redisClient: RedisClient = createClient({
  host: "127.0.0.1",
  port: 6379,
  enable_offline_queue: true,
  retry_strategy: (options: any) => {
    if (options.error && options.error.code === "ECONNREFUSED") {
      console.error("❌ Memurai não está rodando na porta 6379");
      return new Error("Redis connection refused");
    }
    if (options.total_retry_time > 1000 * 60) {
      console.error("❌ Redis retry time exhausted");
      return new Error("Redis retry time exhausted");
    }
    if (options.attempt > 10) {
      console.error("❌ Muitas tentativas de reconexão ao Redis");
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  },
});

redisClient.on("connect", () => {
  console.log("✅ Memurai (Redis) conectado com sucesso!");
});

redisClient.on("ready", () => {
  console.log("🚀 Memurai pronto para usar");
  console.log("⏱️ Redis client connected:", redisClient.connected);

  redisClient.ping((err, result) => {
    if (err) {
      console.error("❌ Erro ao fazer ping no Redis:", err);
    } else {
      console.log("✅ Redis ping bem-sucedido:", result);
    }
  });
});

redisClient.on("error", (err: Error) => {
  console.error("⚠️ Erro no Memurai (não crítico):", err.message);
});

redisClient.on("end", () => {
  console.log("⚠️ Conexão com Redis foi encerrada!");
  console.log(
    "⚠️ Isso pode causar problemas. Verifique se o Memurai está rodando."
  );
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis tentando reconectar...");
});

export const sessionConfig: session.SessionOptions = {
  store: new RedisStore({
    client: redisClient,
    ttl: 60 * 60 * 24,
  }),
  secret: process.env.SESSION_SECRET || "MUDE-ISSO-EM-PRODUCAO",
  resave: false,
  saveUninitialized: false,
  name: "spottoyt_session",
  rolling: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: "lax",
    path: "/",
  },
};
