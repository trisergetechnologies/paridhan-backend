import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    refreshJti: {
      type: String,
      required: true,
      index: true,
    },
    userAgent: String,
    ip: String,
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: Date,
    lastRotatedAt: Date,
  },
  { timestamps: true }
);

const AuthSession = mongoose.model("AuthSession", authSessionSchema);
export default AuthSession;
