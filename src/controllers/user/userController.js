import User from "../../models/User.js";

export const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(200).json({
        success: false,
        message: "Current password and new password (min 6 chars) are required",
        data: null,
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(200).json({ success: false, message: "User not found", data: null });
    }

    const ok = await user.matchPassword(currentPassword);
    if (!ok) {
      return res.status(200).json({
        success: false,
        message: "Current password is incorrect",
        data: null,
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const data = req.user.toObject ? req.user.toObject() : req.user;
    data.activeRole = req.auth?.activeRole || req.user.role;
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    if (!name && !phone && !avatar) {
      return res.status(200).json({
        success: false,
        message: "Nothing to update",
        data: null
      });
    }

    if (name) req.user.name = name;
    if (phone) req.user.phone = phone;
    if (avatar) req.user.avatar = avatar;

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        avatar: req.user.avatar
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