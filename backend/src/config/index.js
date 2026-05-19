require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3333,
  nodeEnv: process.env.NODE_ENV || "development",

  jwt: {
    secret: process.env.JWT_SECRET || "default-insecure-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },

  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_NAME || "estoque_cinema",
    user: process.env.DB_USER || "cinepolis_estacao",
    password: process.env.DB_PASSWORD || "",
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },
};
