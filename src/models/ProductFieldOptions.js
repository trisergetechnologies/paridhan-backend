import mongoose from "mongoose";
import {
  DEFAULT_PRODUCT_FIELD_OPTIONS,
  normalizeOptionsObject,
  PRODUCT_FIELD_KEYS,
} from "../config/productFieldOptionsDefaults.js";

const optionArrays = Object.fromEntries(
  PRODUCT_FIELD_KEYS.map((key) => [key, { type: [String], default: [] }]),
);

const productFieldOptionsSchema = new mongoose.Schema(
  {
    options: optionArrays,
  },
  { timestamps: true },
);

const ProductFieldOptions = mongoose.model("ProductFieldOptions", productFieldOptionsSchema);

export async function getProductFieldOptionsDoc() {
  let doc = await ProductFieldOptions.findOne();
  if (!doc) {
    doc = await ProductFieldOptions.create({
      options: normalizeOptionsObject(DEFAULT_PRODUCT_FIELD_OPTIONS),
    });
  }
  return doc;
}

/** Read stored lists (empty array = no suggestions for that field). */
export function optionsFromDoc(doc) {
  const stored = doc?.options || {};
  const out = {};
  for (const key of PRODUCT_FIELD_KEYS) {
    out[key] = normalizeOptionList(stored[key]);
  }
  return out;
}

export default ProductFieldOptions;
