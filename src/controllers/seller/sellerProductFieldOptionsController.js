import { getProductFieldOptionsDoc, optionsFromDoc } from "../../models/ProductFieldOptions.js";

export const getSellerProductFieldOptions = async (_req, res) => {
  try {
    const doc = await getProductFieldOptionsDoc();
    return res.status(200).json({
      success: true,
      message: "Product field options",
      data: { options: optionsFromDoc(doc) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
