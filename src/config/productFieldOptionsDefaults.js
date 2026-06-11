/** Keys stored in ProductFieldOptions and exposed to sellers. */
export const PRODUCT_FIELD_KEYS = [
  "fabric",
  "color",
  "length",
  "occasion",
  "pattern",
  "fit",
  "texture",
  "washCare",
  "ironing",
  "storage",
];

export const PRODUCT_FIELD_LABELS = {
  fabric: "Fabric",
  color: "Colour",
  length: "Saree length",
  occasion: "Occasion",
  pattern: "Pattern",
  fit: "Fit / drape",
  texture: "Texture",
  washCare: "Wash care",
  ironing: "Ironing",
  storage: "Storage",
};

/** Rich starter lists for Indian saree catalogues — admin can edit anytime. */
export const DEFAULT_PRODUCT_FIELD_OPTIONS = {
  fabric: [
    "Silk",
    "Pure Silk",
    "Kanjivaram Silk",
    "Banarasi Silk",
    "Mysore Silk",
    "Tussar Silk",
    "Art Silk",
    "Gaji Silk",
    "Raw Silk",
    "Tissue Silk",
    "Cotton",
    "Handloom Cotton",
    "Linen",
    "Georgette",
    "Chiffon",
    "Organza",
    "Net",
    "Crepe",
    "Satin",
    "Velvet",
    "Chanderi",
    "Maheshwari",
    "Kota Doria",
    "Uppada",
    "Pochampally",
    "Patola",
    "Bandhani",
    "Ikat",
  ],
  color: [
    "Maroon",
    "Red",
    "Wine",
    "Crimson",
    "Gold",
    "Mustard Yellow",
    "Yellow",
    "Orange",
    "Peach",
    "Pink",
    "Magenta",
    "Green",
    "Emerald",
    "Olive",
    "Teal",
    "Navy Blue",
    "Royal Blue",
    "Sky Blue",
    "Ivory",
    "Cream",
    "Beige",
    "White",
    "Black",
    "Grey",
    "Silver",
    "Multi-colour",
    "Pastel tones",
  ],
  length: ["5.5m", "5.8m", "6.3m", "6.5m", "8m (unstitched)"],
  occasion: [
    "Wedding",
    "Bridal",
    "Reception",
    "Engagement",
    "Festive",
    "Party wear",
    "Casual",
    "Office wear",
    "Temple wear",
    "Daily wear",
    "New arrivals",
    "Designer collection",
    "Summer wear",
    "Monsoon collection",
  ],
  pattern: [
    "Woven floral",
    "Banarasi jacquard",
    "Kalamkari print",
    "Block print",
    "Bandhani / tie-dye",
    "Ikat",
    "Checks",
    "Stripes",
    "Plain / solid",
    "Zari border",
    "Temple border",
    "Paithani motif",
    "Digital print",
    "Embroidered",
    "Hand-painted",
    "Woven / printed design",
  ],
  fit: [
    "Ready to drape",
    "Unstitched saree",
    "Pre-pleated",
    "Lightweight drape",
    "Structured fall",
    "Easy-care drape",
  ],
  texture: [
    "Soft and flowy",
    "Crisp handloom",
    "Lightweight sheer",
    "Rich heavy drape",
    "Smooth satin finish",
    "Textured weave",
    "Premium zari finish",
    "Soft, premium finish",
  ],
  washCare: [
    "Dry clean only",
    "Dry clean recommended",
    "Dry clean recommended for silk and zari",
    "Hand wash cold",
    "Gentle machine wash",
    "Do not bleach",
    "Do not wring",
    "Professional clean for zari work",
  ],
  ironing: [
    "Low heat on reverse",
    "Steam iron on low",
    "Do not iron directly on embellishments",
    "Iron on cotton setting",
    "No ironing required",
    "Low heat on reverse; avoid direct heat on embellishments",
  ],
  storage: [
    "Fold in muslin cloth",
    "Store in breathable bag",
    "Keep away from direct sunlight",
    "Store in a cool, dry place",
    "Hang on padded hanger",
    "Avoid plastic covers for silk",
    "Fold in muslin cloth; store in a cool, dry place",
  ],
};

export function normalizeOptionList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const v = String(raw ?? "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function normalizeOptionsObject(input) {
  const base = {};
  for (const key of PRODUCT_FIELD_KEYS) {
    base[key] = normalizeOptionList(input?.[key] ?? DEFAULT_PRODUCT_FIELD_OPTIONS[key]);
  }
  return base;
}
