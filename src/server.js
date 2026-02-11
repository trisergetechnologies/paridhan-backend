import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";

import connectDB from "./config/db.js";
import router from "./routes/index.js";

dotenv.config();
connectDB();

const app = express();

// ================= MIDDLEWARES =================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use('/api/v1', router);

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Paridhan Emporium Backend is running 🚀"
  });
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
