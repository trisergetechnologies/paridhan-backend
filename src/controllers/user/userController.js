
export const getMyProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: req.user
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