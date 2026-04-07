import "../../models/Category.js";
import Product from "../../models/Product.js";
import {
  toPublicProductDetail,
  toPublicProductList,
} from "../../services/productVariantHelpers.js";

function buildBaseMatch(req) {
  const query = { isActive: true, isDeleted: { $ne: true } };

  if (req.query.category) {
    query.categories = req.query.category;
  }

  if (req.query.seller) {
    query.seller = req.query.seller;
  }

  if (req.query.featured === "true") {
    query.isFeatured = true;
  }

  if (req.query.q) {
    const q = String(req.query.q).trim();
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { fabric: { $regex: q, $options: "i" } },
        { color: { $regex: q, $options: "i" } },
      ];
    }
  }

  return query;
}

function buildVariantStatsStages() {
  return [
    {
      $addFields: {
        _activeVariants: {
          $filter: {
            input: { $ifNull: ["$variants", []] },
            as: "v",
            cond: { $ne: ["$$v.isActive", false] },
          },
        },
        _hasVariants: { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
      },
    },
    {
      $addFields: {
        _totalStock: {
          $cond: {
            if: "$_hasVariants",
            then: { $sum: "$_activeVariants.stock" },
            else: "$stock",
          },
        },
        _minPrice: {
          $cond: {
            if: { $gt: [{ $size: "$_activeVariants" }, 0] },
            then: {
              $min: {
                $map: {
                  input: "$_activeVariants",
                  as: "x",
                  in: { $ifNull: ["$$x.price", "$price"] },
                },
              },
            },
            else: "$price",
          },
        },
        _maxPrice: {
          $cond: {
            if: { $gt: [{ $size: "$_activeVariants" }, 0] },
            then: {
              $max: {
                $map: {
                  input: "$_activeVariants",
                  as: "x",
                  in: { $ifNull: ["$$x.price", "$price"] },
                },
              },
            },
            else: "$price",
          },
        },
      },
    },
  ];
}

function buildPostMatch(req) {
  const post = {};

  if (req.query.inStock === "true") {
    post._totalStock = { $gt: 0 };
  }

  const priceExpr = [];
  if (req.query.minPrice) {
    priceExpr.push({ $gte: ["$_maxPrice", Number(req.query.minPrice)] });
  }
  if (req.query.maxPrice) {
    priceExpr.push({ $lte: ["$_minPrice", Number(req.query.maxPrice)] });
  }
  if (priceExpr.length === 1) {
    post.$expr = priceExpr[0];
  } else if (priceExpr.length === 2) {
    post.$expr = { $and: priceExpr };
  }

  return post;
}

function buildSort(req) {
  if (req.query.sort === "price_asc") return { _minPrice: 1 };
  if (req.query.sort === "price_desc") return { _maxPrice: -1 };
  return { createdAt: -1 };
}

/** Max hero slides returned by GET /public/hero (clamped 1–12). */
function getHeroSlideLimit() {
  const n = Number(process.env.HERO_SLIDE_LIMIT);
  const fallback = Number.isFinite(n) && n > 0 ? n : 5;
  return Math.min(Math.max(Math.floor(fallback), 1), 12);
}

function trimHeroSubtitle(text, max = 200) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

const heroLookupCategories = {
  $lookup: {
    from: "categories",
    localField: "categories",
    foreignField: "_id",
    as: "categories",
  },
};

const heroProjectClean = {
  $project: {
    _activeVariants: 0,
    _hasVariants: 0,
    _totalStock: 0,
    _minPrice: 0,
    _maxPrice: 0,
  },
};

/** Aggregation stages for hero candidates: match → variant stats → optional post filter → sort → limit → populate. */
function buildHeroPipeline(baseMatch, postMatch, sort, limit) {
  return [
    { $match: baseMatch },
    ...buildVariantStatsStages(),
    ...(Object.keys(postMatch).length ? [{ $match: postMatch }] : []),
    { $sort: sort },
    { $limit: limit },
    heroLookupCategories,
    heroProjectClean,
  ];
}

/**
 * GET /public/hero — carousel slides from the catalog.
 * 1) Featured products (isFeatured, active, not deleted).
 * 2) If none: latest in-stock products.
 * 3) If still none: latest products (any stock).
 */
export const getHeroSlides = async (req, res) => {
  try {
    const limit = getHeroSlideLimit();
    const sort = { createdAt: -1 };
    const placeholderImage =
      String(process.env.HERO_PLACEHOLDER_IMAGE_URL || "").trim() ||
      "https://picsum.photos/seed/paridhan-hero/1920/1080";

    const featuredMatch = buildBaseMatch({ query: { featured: "true" } });
    let rawItems = await Product.aggregate(buildHeroPipeline(featuredMatch, {}, sort, limit));
    let source = "featured";

    if (!rawItems.length) {
      const anyMatch = buildBaseMatch({ query: {} });
      rawItems = await Product.aggregate(
        buildHeroPipeline(anyMatch, { _totalStock: { $gt: 0 } }, sort, limit),
      );
      source = "latest_in_stock";
    }

    if (!rawItems.length) {
      const anyMatch = buildBaseMatch({ query: {} });
      rawItems = await Product.aggregate(buildHeroPipeline(anyMatch, {}, sort, limit));
      source = "latest";
    }

    const totalFeatured = await Product.countDocuments(
      buildBaseMatch({ query: { featured: "true" } }),
    );

    const eyebrowBySource = {
      featured: "Featured now",
      latest_in_stock: "New in store",
      latest: "Discover",
    };

    const slides = rawItems.map((doc) => {
      const item = toPublicProductList(doc);
      const img = (item.images?.[0]?.url || "").trim();
      return {
        id: item.publicId,
        eyebrow: eyebrowBySource[source] || "Shop now",
        title: item.name,
        subtitle: trimHeroSubtitle(
          item.description || "Curated styles for celebrations and every day.",
        ),
        image: img || placeholderImage,
        cta: "Shop this look",
        href: `/product/${item.slug}`,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Hero slides fetched successfully",
      data: {
        limit,
        source,
        totalFeatured,
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

export const getAllProducts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const baseMatch = buildBaseMatch(req);
    const postMatch = buildPostMatch(req);
    const sort = buildSort(req);

    const lookupCategories = {
      $lookup: {
        from: "categories",
        localField: "categories",
        foreignField: "_id",
        as: "categories",
      },
    };

    const projectClean = {
      $project: {
        _activeVariants: 0,
        _hasVariants: 0,
        _totalStock: 0,
        _minPrice: 0,
        _maxPrice: 0,
      },
    };

    const pipeline = [
      { $match: baseMatch },
      ...buildVariantStatsStages(),
      ...(Object.keys(postMatch).length ? [{ $match: postMatch }] : []),
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: skip },
            { $limit: limit },
            lookupCategories,
            projectClean,
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const [agg] = await Product.aggregate(pipeline);

    const rawItems = agg?.items || [];
    const total = agg?.totalCount?.[0]?.count ?? 0;

    const responsePayload = {
      success: true,
      message: "Products fetched successfully",
      data: {
        items: rawItems.map((doc) => toPublicProductList(doc)),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        },
      },
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({
      slug: String(slug).toLowerCase(),
      isActive: true,
      isDeleted: { $ne: true },
    })
      .populate("categories", "name slug")
      .lean();

    if (!product) {
      return res.status(200).json({
        success: false,
        message: "Product not found",
        data: null,
      });
    }

    const responsePayload = {
      success: true,
      message: "Product fetched successfully",
      data: toPublicProductDetail(product),
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};
