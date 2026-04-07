import Category from "../../models/Category.js";

export const listPublicCategories = async (_req, res) => {
  try {
    const items = await Category.find({ isActive: true })
      .select("name slug")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Categories fetched",
      data: { items },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
