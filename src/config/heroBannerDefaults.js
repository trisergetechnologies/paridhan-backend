/** Default homepage hero copy — used until admin uploads a custom banner. */
export const DEFAULT_HERO_BANNER = {
  image: "",
  imageFileId: "",
  eyebrow: "Paridhan Emporium",
  title: "Timeless sarees for every occasion",
  subtitle:
    "Handpicked silks, cottons, and festive weaves. Explore the collection or check back for new arrivals.",
  cta: "Explore the shop",
  href: "/shop",
};

export function defaultHeroPlaceholderImage() {
  return (
    String(process.env.HERO_PLACEHOLDER_IMAGE_URL || "").trim() ||
    "https://images.unsplash.com/photo-1610030161231-d2f51196ca8c?auto=format&fit=crop&w=1920&q=80"
  );
}

/** Build the single static slide consumed by GET /public/hero. */
export function buildHeroSlidesFromSettings(doc) {
  const stored = doc?.hero && typeof doc.hero.toObject === "function" ? doc.hero.toObject() : doc?.hero;
  const hero = { ...DEFAULT_HERO_BANNER, ...(stored || {}) };
  const image = String(hero.image || "").trim() || defaultHeroPlaceholderImage();

  return [
    {
      id: "storefront-hero",
      eyebrow: String(hero.eyebrow || DEFAULT_HERO_BANNER.eyebrow).trim(),
      title: String(hero.title || DEFAULT_HERO_BANNER.title).trim(),
      subtitle: String(hero.subtitle || DEFAULT_HERO_BANNER.subtitle).trim(),
      image,
      cta: String(hero.cta || DEFAULT_HERO_BANNER.cta).trim(),
      href: String(hero.href || DEFAULT_HERO_BANNER.href).trim() || "/shop",
    },
  ];
}

export function heroBannerForAdmin(doc) {
  const stored = doc?.hero && typeof doc.hero.toObject === "function" ? doc.hero.toObject() : doc?.hero;
  const hero = { ...DEFAULT_HERO_BANNER, ...(stored || {}) };
  return {
    image: String(hero.image || "").trim(),
    imageFileId: String(hero.imageFileId || "").trim(),
    eyebrow: String(hero.eyebrow || DEFAULT_HERO_BANNER.eyebrow).trim(),
    title: String(hero.title || DEFAULT_HERO_BANNER.title).trim(),
    subtitle: String(hero.subtitle || DEFAULT_HERO_BANNER.subtitle).trim(),
    cta: String(hero.cta || DEFAULT_HERO_BANNER.cta).trim(),
    href: String(hero.href || DEFAULT_HERO_BANNER.href).trim() || "/shop",
  };
}
