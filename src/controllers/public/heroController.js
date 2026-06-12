import { buildHeroSlidesFromSettings } from "../../config/heroBannerDefaults.js";
import { getStorefrontSettingsDoc } from "../../models/StorefrontSettings.js";

/** GET /public/hero — static homepage banner configured by platform admin. */
export const getHeroSlides = async (_req, res) => {
  try {
    const doc = await getStorefrontSettingsDoc();
    const slides = buildHeroSlidesFromSettings(doc);

    return res.status(200).json({
      success: true,
      message: "Hero slides fetched successfully",
      data: {
        limit: 1,
        source: "admin",
        slides,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
