/**
 * Product variant helpers: embedded variants on Product, optional per-variant images (inherit or replace).
 */

export function hasVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

export function activeVariants(product) {
  if (!hasVariants(product)) return [];
  return product.variants.filter((v) => v.isActive !== false);
}

export function getTotalStock(product) {
  if (hasVariants(product)) {
    return activeVariants(product).reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }
  return Number(product.stock) || 0;
}

export function productInStock(product) {
  return getTotalStock(product) > 0;
}

export function getEffectiveVariantPrice(variant, product) {
  const price =
    variant != null && variant.price != null && variant.price !== undefined
      ? Number(variant.price)
      : Number(product.price);
  const mrp =
    variant != null && variant.mrp != null && variant.mrp !== undefined
      ? Number(variant.mrp)
      : product.mrp != null
        ? Number(product.mrp)
        : undefined;
  return { price, mrp };
}

/** Variant override images if non-empty; else product.images */
export function effectiveImages(product, variant) {
  const root = Array.isArray(product.images) ? product.images : [];
  if (!variant || !Array.isArray(variant.images) || variant.images.length === 0) {
    return root;
  }
  return variant.images;
}

export function resolveVariant(product, variantPublicId) {
  if (!hasVariants(product) || !variantPublicId) return null;
  return (
    product.variants.find(
      (v) => v.publicId === variantPublicId && v.isActive !== false
    ) || null
  );
}

export function variantLabel(variant) {
  if (!variant?.attributes?.length) return "";
  return variant.attributes.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export function getMinMaxPrice(product) {
  if (!hasVariants(product)) {
    const p = Number(product.price) || 0;
    return { min: p, max: p };
  }
  const vars = activeVariants(product);
  if (vars.length === 0) {
    const p = Number(product.price) || 0;
    return { min: p, max: p };
  }
  const prices = vars.map((v) => getEffectiveVariantPrice(v, product).price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** First active variant publicId for list defaults (e.g. quick add) */
export function defaultVariantPublicId(product) {
  const v = activeVariants(product)[0];
  return v?.publicId || null;
}

export function toPublicVariantDetail(product, variant) {
  const { price, mrp } = getEffectiveVariantPrice(variant, product);
  const imgs = effectiveImages(product, variant);
  return {
    publicId: variant.publicId,
    attributes: variant.attributes || [],
    sku: variant.sku || null,
    price,
    mrp: mrp ?? null,
    stock: Number(variant.stock) || 0,
    isActive: variant.isActive !== false,
    images: variant.images?.length ? variant.images : null,
    effectiveImages: imgs,
  };
}

export function toPublicProductList(product) {
  const { min: fromPrice, max: toPrice } = getMinMaxPrice(product);
  const variantCount = hasVariants(product) ? product.variants.length : 0;
  const inStock = productInStock(product);
  const totalStock = getTotalStock(product);

  const variantOptions = hasVariants(product)
    ? activeVariants(product).slice(0, 5).map((v) => {
        const { price } = getEffectiveVariantPrice(v, product);
        let label = variantLabel(v);
        if (label.length > 24) label = `${label.slice(0, 22)}…`;
        return {
          publicId: v.publicId,
          label: label || "Option",
          price,
          stock: Number(v.stock) || 0,
        };
      })
    : [];

  return {
    publicId: product.publicId,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    mrp: product.mrp,
    fromPrice,
    toPrice,
    variantCount,
    variantOptions,
    inStock,
    stock: totalStock,
    isActive: product.isActive,
    isFeatured: product.isFeatured,
    images: product.images,
    categories: product.categories,
    defaultVariantPublicId: defaultVariantPublicId(product),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function toPublicProductDetail(product) {
  const base = toPublicProductList(product);
  const variants = hasVariants(product)
    ? activeVariants(product).map((v) => toPublicVariantDetail(product, v))
    : [];

  return {
    ...base,
    description: product.description,
    fabric: product.fabric,
    color: product.color,
    blouseIncluded: product.blouseIncluded !== false,
    length: product.length || "5.5m",
    occasion: product.occasion,
    pattern: product.pattern,
    fit: product.fit,
    texture: product.texture,
    washCare: product.washCare,
    ironing: product.ironing,
    storage: product.storage,
    discountPercentage:
      product.discountPercentage != null
        ? Number(product.discountPercentage)
        : product.mrp && product.mrp > product.price
          ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
          : 0,
    variants,
  };
}
