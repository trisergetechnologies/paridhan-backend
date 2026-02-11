import '../../models/Category.js';
import Product from "../../models/Product.js";

export const getAllProducts = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;

    const skip = (page - 1) * limit;

    const query = {
      isActive: true
    };

    // ================= OPTIONAL FILTERS =================
    if (req.query.category) {
      query.categories = req.query.category;
    }

    if (req.query.seller) {
      query.seller = req.query.seller;
    }

    if (req.query.featured === "true") {
      query.isFeatured = true;
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice)
        query.price.$gte = Number(req.query.minPrice);
      if (req.query.maxPrice)
        query.price.$lte = Number(req.query.maxPrice);
    }

    // ================= SORTING =================
    let sort = { createdAt: -1 };

    if (req.query.sort === "price_asc") sort = { price: 1 };
    if (req.query.sort === "price_desc") sort = { price: -1 };
    if (req.query.sort === "latest") sort = { createdAt: -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("categories", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Product.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: {
        items: products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      isActive: true
    }).populate("categories", "name slug");

    if (!product) {
      return res.status(200).json({
        success: false,
        message: "Product not found",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};
