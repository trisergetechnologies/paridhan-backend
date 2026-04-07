import "../../models/Category.js";
import Product from "../../models/Product.js";
import {
  toPublicProductDetail,
  toPublicProductList,
} from "../../services/productVariantHelpers.js";

function buildBaseMatch(req) {
  const query = { isActive: true };

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

/**
 * Featured products formatted for the home hero carousel.
 * Limit is controlled by HERO_SLIDE_LIMIT (default 5).
 */
export const getHeroSlides = async (req, res) => {
  try {
    const limit = getHeroSlideLimit();
    const baseMatch = buildBaseMatch({ query: { featured: "true" } });
    const postMatch = {};
    const sort = buildSort({ query: {} });

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
            { $skip: 0 },
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
    const totalFeatured = agg?.totalCount?.[0]?.count ?? 0;

    const slides = rawItems.map((doc) => {
      const item = toPublicProductList(doc);
      return {
        id: item.publicId,
        eyebrow: "Featured now",
        title: item.name,
        subtitle: trimHeroSubtitle(
          item.description ||
            "Curated premium styles for celebrations and every day in between."
        ),
        image: item.images?.[0]?.url || "/images/collection01.png",
        cta: "Shop this look",
        href: `/product/${item.slug}`,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Hero slides fetched successfully",
      data: {
        limit,
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
