import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";

export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "slug isActive stock"
    );

    if (!cart) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: {
          items: [],
          itemsTotal: 0,
          taxAmount: 0,
          deliveryCharge: 0,
          grandTotal: 0
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      return res.status(200).json({
        success: false,
        message: "Product ID is required",
        data: null
      });
    }

    const product = await Product.findById(productId);

    if (!product || !product.isActive) {
      return res.status(200).json({
        success: false,
        message: "Product not available",
        data: null
      });
    }

    if (product.stock < quantity) {
      return res.status(200).json({
        success: false,
        message: "Insufficient stock",
        data: null
      });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
      cart.items[itemIndex].subtotal =
        cart.items[itemIndex].price * cart.items[itemIndex].quantity;
    } else {
      cart.items.push({
        product: product._id,
        seller: product.seller,
        name: product.name,
        image: product.images?.[0]?.url || "",
        price: product.price,
        mrp: product.mrp,
        quantity,
        subtotal: product.price * quantity
      });
    }

    // ================= RECALCULATE TOTALS =================
    cart.itemsTotal = cart.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    cart.taxAmount = Math.round(cart.itemsTotal * 0.05);
    cart.deliveryCharge = cart.itemsTotal >= 999 ? 0 : 80;
    cart.grandTotal =
      cart.itemsTotal + cart.taxAmount + cart.deliveryCharge;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: false,
        message: "Cart not found",
        data: null
      });
    }

    const initialLength = cart.items.length;

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    if (cart.items.length === initialLength) {
      return res.status(200).json({
        success: false,
        message: "Product not found in cart",
        data: null
      });
    }

    cart.itemsTotal = cart.items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );

    cart.taxAmount = Math.round(cart.itemsTotal * 0.05);
    cart.deliveryCharge = cart.itemsTotal >= 999 ? 0 : 80;
    cart.grandTotal =
      cart.itemsTotal + cart.taxAmount + cart.deliveryCharge;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndDelete({ user: req.user._id });

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
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
