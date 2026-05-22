import Cart from "../../models/Cart.js";
import Product from "../../models/Product.js";
import { calculateCartTotals } from "../../services/pricingService.js";
import {
  effectiveImages,
  getEffectiveVariantPrice,
  hasVariants,
  resolveVariant,
  variantLabel,
} from "../../services/productVariantHelpers.js";

/** Per-line cap for UI: min(50, available stock). Requires populated `item.product`. */
function maxQuantityForCartItem(item) {
  const p = item.product;
  if (!p || typeof p !== "object" || !p.publicId) {
    return undefined;
  }
  const variantPublicId = item.variantPublicId
    ? String(item.variantPublicId).trim()
    : "";
  const variant = hasVariants(p) ? resolveVariant(p, variantPublicId) : null;
  const stockAvailable = hasVariants(p)
    ? Number(variant?.stock) || 0
    : Number(p.stock) || 0;
  return Math.min(50, Math.max(0, stockAvailable));
}

const toPublicCart = (cart) => ({
  ...cart.toObject(),
  items: cart.items.map((item) => ({
    ...item.toObject(),
    productId: item.product?.publicId || null,
    productSlug: item.product?.slug || null,
    maxQuantity: maxQuantityForCartItem(item),
  })),
});

function sameCartLine(a, b) {
  const va = a.variantPublicId || "";
  const vb = b.variantPublicId || "";
  return a.product.toString() === b.product.toString() && va === vb;
}

export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "publicId slug isActive stock variants price mrp images name gstPercent hsnCode"
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
      data: toPublicCart(cart)
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
    const {
      productId,
      quantity = 1,
      variantPublicId: bodyVariantId,
      setQuantity: bodySetQuantity,
    } = req.body;

    const isSet = Boolean(bodySetQuantity);

    if (!productId) {
      return res.status(200).json({
        success: false,
        message: "Product ID is required",
        data: null
      });
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 50) {
      return res.status(200).json({
        success: false,
        message: "Quantity must be an integer between 1 and 50",
        data: null
      });
    }

    const product = await Product.findOne({ publicId: productId });

    if (!product || !product.isActive) {
      return res.status(200).json({
        success: false,
        message: "Product not available",
        data: null
      });
    }

    const variantPublicId = bodyVariantId ? String(bodyVariantId).trim() : "";

    if (hasVariants(product)) {
      if (!variantPublicId) {
        return res.status(200).json({
          success: false,
          message: "Variant is required for this product",
          data: null
        });
      }
    }

    const variant = hasVariants(product)
      ? resolveVariant(product, variantPublicId)
      : null;

    if (hasVariants(product) && !variant) {
      return res.status(200).json({
        success: false,
        message: "Selected variant is not available",
        data: null
      });
    }

    const { price, mrp } = getEffectiveVariantPrice(variant, product);
    const imgs = effectiveImages(product, variant);
    const image = imgs[0]?.url || "";
    const vLabel = variant ? variantLabel(variant) : "";
    const stockAvailable = hasVariants(product)
      ? Number(variant.stock) || 0
      : Number(product.stock) || 0;

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const lineProbe = {
      product: product._id,
      variantPublicId: variantPublicId || undefined,
    };

    const itemIndex = cart.items.findIndex((i) =>
      sameCartLine(i, lineProbe)
    );

    if (itemIndex > -1) {
      if (isSet) {
        if (stockAvailable < 1) {
          return res.status(200).json({
            success: false,
            message: "Insufficient stock",
            data: null
          });
        }
        const nextQuantity = Math.max(
          1,
          Math.min(parsedQuantity, stockAvailable, 50)
        );
        cart.items[itemIndex].quantity = nextQuantity;
        cart.items[itemIndex].subtotal =
          cart.items[itemIndex].price * cart.items[itemIndex].quantity;
      } else {
        const nextQuantity = cart.items[itemIndex].quantity + parsedQuantity;
        if (stockAvailable < nextQuantity) {
          return res.status(200).json({
            success: false,
            message: "Insufficient stock",
            data: null
          });
        }
        cart.items[itemIndex].quantity = nextQuantity;
        cart.items[itemIndex].subtotal =
          cart.items[itemIndex].price * cart.items[itemIndex].quantity;
      }
    } else {
      if (isSet) {
        return res.status(200).json({
          success: false,
          message: "Cart line not found",
          data: null
        });
      }
      if (stockAvailable < parsedQuantity) {
        return res.status(200).json({
          success: false,
          message: "Insufficient stock",
          data: null
        });
      }
      const newItem = {
        product: product._id,
        seller: product.seller,
        name: product.name,
        image,
        price,
        mrp: mrp ?? product.mrp,
        quantity: parsedQuantity,
        subtotal: price * parsedQuantity,
      };
      if (product.gstPercent != null && product.gstPercent !== "") {
        newItem.gstPercent = Number(product.gstPercent);
      }
      if (product.hsnCode) {
        newItem.hsnCode = String(product.hsnCode).trim();
      }
      if (variantPublicId) {
        newItem.variantPublicId = variantPublicId;
        newItem.variantLabel = vLabel;
      }
      cart.items.push(newItem);
    }

    Object.assign(cart, calculateCartTotals(cart.items));

    await cart.save();

    await cart.populate(
      "items.product",
      "publicId slug isActive stock variants price mrp images name gstPercent hsnCode"
    );

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: toPublicCart(cart)
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
    const variantPublicId = req.query.variantPublicId
      ? String(req.query.variantPublicId).trim()
      : "";

    const product = await Product.findOne({ publicId: productId }).select("_id");
    if (!product) {
      return res.status(200).json({
        success: false,
        message: "Product not found",
        data: null
      });
    }

    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      return res.status(200).json({
        success: false,
        message: "Cart not found",
        data: null
      });
    }

    const lineProbe = {
      product: product._id,
      variantPublicId: variantPublicId || undefined,
    };

    const initialLength = cart.items.length;

    cart.items = cart.items.filter((item) => !sameCartLine(item, lineProbe));

    if (cart.items.length === initialLength) {
      return res.status(200).json({
        success: false,
        message: "Product not found in cart",
        data: null
      });
    }

    Object.assign(cart, calculateCartTotals(cart.items));

    await cart.save();

    await cart.populate(
      "items.product",
      "publicId slug isActive stock variants price mrp images name gstPercent hsnCode"
    );

    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      data: toPublicCart(cart)
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
