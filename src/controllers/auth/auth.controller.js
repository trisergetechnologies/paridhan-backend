import User from "../../models/User.js";
import generateToken from "../../utils/generateToken.js";


/**
 * @route   POST /api/auth/register
 * @desc    Register customer
 * @access  Public
 */
export const registerCustomer = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(200).json({
        success: false,
        message: "Required fields missing",
        data: null
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(200).json({
        success: false,
        message: "User already exists",
        data: null
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: "customer"
    });

    const token = generateToken({
      id: user._id,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: "Registration successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


/**
 * @route   POST /api/auth/login
 * @desc    Login customer
 * @access  Public
 */
export const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({
        success: false,
        message: "Email and password are required",
        data: null
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
        data: null
      });
    }

    if (user.isBlocked || user.isDeleted) {
      return res.status(200).json({
        success: false,
        message: "Account is disabled",
        data: null
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(200).json({
        success: false,
        message: "Invalid credentials",
        data: null
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken({
      id: user._id,
      role: user.role
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};
