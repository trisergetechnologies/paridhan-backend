import { getStorefrontSettingsDoc } from "../../models/StorefrontSettings.js";

export const getPublicStorefrontMode = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const doc = await getStorefrontSettingsDoc();
    return res.status(200).json({
      success: true,
      message: "Storefront mode",
      data: { mode: doc.mode },
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: "Defaulting to live",
      data: { mode: "live" },
    });
  }
};
