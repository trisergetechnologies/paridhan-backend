import mongoose from "mongoose";
import { DEFAULT_HERO_BANNER } from "../config/heroBannerDefaults.js";

const heroBannerSchema = new mongoose.Schema(
  {
    image: { type: String, default: "" },
    imageFileId: { type: String, default: "" },
    eyebrow: { type: String, default: DEFAULT_HERO_BANNER.eyebrow },
    title: { type: String, default: DEFAULT_HERO_BANNER.title },
    subtitle: { type: String, default: DEFAULT_HERO_BANNER.subtitle },
    cta: { type: String, default: DEFAULT_HERO_BANNER.cta },
    href: { type: String, default: DEFAULT_HERO_BANNER.href },
  },
  { _id: false },
);

const storefrontSettingsSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["live", "maintenance", "coming_soon"],
      default: "live",
    },
    hero: {
      type: heroBannerSchema,
      default: () => ({ ...DEFAULT_HERO_BANNER }),
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
