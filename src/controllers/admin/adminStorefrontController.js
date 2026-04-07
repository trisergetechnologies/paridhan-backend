import { getStorefrontSettingsDoc } from "../../models/StorefrontSettings.js";

const MODES = new Set(["live", "maintenance", "coming_soon"]);

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
