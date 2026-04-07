import User from "../../models/User.js";
import Product from "../../models/Product.js";
import { toPublicProductList } from "../../services/productVariantHelpers.js";

export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "wishlist",
      populate: { path: "categories", select: "name slug" },
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: "Wishlist fetched successfully",
        data: [],
      });
    }

    const activeProducts = (user.wishlist || []).filter(
      (p) => p != null && p.isActive !== false
    );
    const data = activeProducts.map((doc) => toPublicProductList(doc));

    return res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(200).json({
        success: false,
        message: "Product ID is required",
        data: null
      });
    }

    const product = await Product.findOne({ publicId: productId }).select(
      "_id isActive"
    );
    if (!product) {
      return res.status(200).json({
        success: false,
        message: "Product not found",
        data: null
      });
    }

    if (!product.isActive) {
      return res.status(200).json({
        success: false,
        message: "Product is not available",
        data: null
      });
    }

    const user = await User.findById(req.user._id);

    if (user.wishlist.some((id) => String(id) === String(product._id))) {
      return res.status(200).json({
        success: false,
        message: "Product already in wishlist",
        data: null
      });
    }

    user.wishlist.push(product._id);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Product added to wishlist",
      data: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findOne({ publicId: productId }).select("_id");
    if (!product) {
      return res.status(200).json({
        success: false,
        message: "Product not found",
        data: null
      });
    }

    const user = await User.findById(req.user._id);

    const index = user.wishlist.findIndex((id) => String(id) === String(product._id));

    if (index === -1) {
      return res.status(200).json({
        success: false,
        message: "Product not found in wishlist",
        data: null
      });
    }

    user.wishlist.splice(index, 1);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from wishlist",
      data: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};
