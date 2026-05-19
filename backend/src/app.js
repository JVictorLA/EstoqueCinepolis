const express = require("express");
const cors = require("cors");
const config = require("./config");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middlewares/errors");

const app = express();

const corsOrigin = config.cors.origin === "*" ? true : config.cors.origin.split(",").map((s) => s.trim());
app.use(cors({ origin: corsOrigin, credentials: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Logger simples
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
