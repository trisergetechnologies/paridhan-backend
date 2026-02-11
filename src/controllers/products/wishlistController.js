import User from "../../models/User.js";

export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "wishlist",
      "name price images slug stock isActive"
    );

    return res.status(200).json({
      success: true,
      message: "Wishlist fetched successfully",
      data: user.wishlist
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

    const user = await User.findById(req.user._id);

    if (user.wishlist.includes(productId)) {
      return res.status(200).json({
        success: false,
        message: "Product already in wishlist",
        data: null
      });
    }

    user.wishlist.push(productId);
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

    const user = await User.findById(req.user._id);

    const index = user.wishlist.indexOf(productId);

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
