import mongoose from "mongoose";

const storefrontSettingsSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["live", "maintenance", "coming_soon"],
      default: "live",
    },
  },
  { timestamps: true },
);

const StorefrontSettings = mongoose.model("StorefrontSettings", storefrontSettingsSchema);

/** Single-row settings: create default if missing. */
export async function getStorefrontSettingsDoc() {
  let doc = await StorefrontSettings.findOne();
  if (!doc) {
    doc = await StorefrontSettings.create({ mode: "live" });
  }
  return doc;
}

export default StorefrontSettings;
