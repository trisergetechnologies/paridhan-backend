import { getStorefrontSettingsDoc } from "../../models/StorefrontSettings.js";
import { heroBannerForAdmin } from "../../config/heroBannerDefaults.js";

const MODES = new Set(["live", "maintenance", "coming_soon"]);

const HERO_PATCH_KEYS = ["image", "imageFileId", "eyebrow", "title", "subtitle", "cta", "href"];

export const getAdminStorefrontMode = async (req, res) => {
  try {
    const doc = await getStorefrontSettingsDoc();
    return res.status(200).json({
      success: true,
      message: "Storefront mode",
      data: { mode: doc.mode },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const patchAdminStorefrontMode = async (req, res) => {
  try {
    const { mode } = req.body;
    if (!MODES.has(mode)) {
      return res.status(200).json({
        success: false,
        message: "mode must be live, maintenance, or coming_soon",
        data: null,
      });
    }
    const doc = await getStorefrontSettingsDoc();
    doc.mode = mode;
    await doc.save();
    return res.status(200).json({
      success: true,
      message: "Storefront mode updated",
      data: { mode: doc.mode },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const getAdminHeroBanner = async (_req, res) => {
  try {
    const doc = await getStorefrontSettingsDoc();
    return res.status(200).json({
      success: true,
      message: "Homepage hero banner",
      data: { hero: heroBannerForAdmin(doc) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

export const patchAdminHeroBanner = async (req, res) => {
  try {
    const incoming = req.body?.hero ?? req.body;
    if (!incoming || typeof incoming !== "object") {
      return res.status(200).json({
        success: false,
        message: "hero object is required",
        data: null,
      });
    }

    const doc = await getStorefrontSettingsDoc();
    if (!doc.hero) doc.hero = {};

    for (const key of HERO_PATCH_KEYS) {
      if (incoming[key] === undefined) continue;
      doc.hero[key] = String(incoming[key] ?? "").trim();
    }

    doc.markModified("hero");
    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Homepage hero banner updated",
      data: { hero: heroBannerForAdmin(doc) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
