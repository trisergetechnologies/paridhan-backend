import {
  normalizeOptionList,
  normalizeOptionsObject,
  PRODUCT_FIELD_KEYS,
} from "../../config/productFieldOptionsDefaults.js";
import { getProductFieldOptionsDoc, optionsFromDoc } from "../../models/ProductFieldOptions.js";

export const getAdminProductFieldOptions = async (_req, res) => {
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

export const patchAdminProductFieldOptions = async (req, res) => {
  try {
    const doc = await getProductFieldOptionsDoc();
    const incoming = req.body?.options;

    if (!incoming || typeof incoming !== "object") {
      return res.status(200).json({
        success: false,
        message: "options object is required",
        data: null,
      });
    }

    const next = { ...optionsFromDoc(doc) };
    for (const key of PRODUCT_FIELD_KEYS) {
      if (incoming[key] === undefined) continue;
      next[key] = normalizeOptionList(incoming[key]);
    }

    doc.options = normalizeOptionsObject(next);
    await doc.save();

    return res.status(200).json({
      success: true,
      message: "Product field options updated",
      data: { options: optionsFromDoc(doc) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};
