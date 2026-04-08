import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";

import { ensureRedis } from "./config/redis.js";
import connectDB from "./config/db.js";
import router from "./routes/index.js";

dotenv.config();
connectDB();

const app = express();

// ================= MIDDLEWARES =================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/v1", (req, res, next) => {
  const txId = req.headers["x-transaction-id"];
  const ts = req.headers["x-request-timestamp"];
  if (txId) {
    res.setHeader("X-Transaction-Id", String(txId));
  }
  if (ts) {
    res.setHeader("X-Request-Timestamp", String(ts));
  }
  next();
});

app.use("/api/v1", router);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Paridhan Emporium Backend is running 🚀"
  });
});

const noStore = (res) => {
  res.setHeader("Cache-Control", "no-store");
  return res;
};

const timed = async (fn) => {
  const started = Date.now();
  try {
    await fn();
    return { status: "up", latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

app.get("/health/live", (_req, res) => {
  return noStore(res).status(200).json({
    service: "paridhan-backend",
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
  });
});

app.get("/health/ready", async (_req, res) => {
  const mongoCheck = timed(async () => {
    await mongoose.connection.db.admin().ping();
  });

  const redisCheck = timed(async () => {
    const redis = await ensureRedis();
    if (!redis) {
      throw new Error("Redis unavailable or REDIS_URL missing");
    }
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error("Redis ping failed");
  });

  const [mongo, redis] = await Promise.all([mongoCheck, redisCheck]);
  const checks = { mongo, redis };
  const allHealthy = mongo.status === "up" && redis.status === "up";

  return noStore(res).status(allHealthy ? 200 : 503).json({
    service: "paridhan-backend",
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    checks,
  });
});

// ================= SERVER =================
const PORT = process.env.PORT || 4600;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
