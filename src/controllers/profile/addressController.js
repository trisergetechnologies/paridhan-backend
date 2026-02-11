export const getMyAddresses = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const total = req.user.addresses.length;

    const addresses = req.user.addresses.slice(
      skip,
      skip + limit
    );

    return res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      data: {
        items: addresses,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
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


export const addAddress = async (req, res) => {
  try {
    const {
      slug,
      fullName,
      phone,
      street,
      city,
      state,
      postalCode,
      country,
      isDefault
    } = req.body;

    if (!slug || !fullName || !phone || !street) {
      return res.status(200).json({
        success: false,
        message: "Required address fields missing",
        data: null
      });
    }

    const existing = req.user.addresses.find(
      (addr) => addr.slug === slug
    );

    if (existing) {
      return res.status(200).json({
        success: false,
        message: "Address slug already exists",
        data: null
      });
    }

    if (isDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    req.user.addresses.push({
      slug,
      fullName,
      phone,
      street,
      city,
      state,
      postalCode,
      country,
      isDefault: !!isDefault
    });

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: req.user.addresses
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const updateAddress = async (req, res) => {
  try {
    const { slug } = req.params;

    const address = req.user.addresses.find(
      (addr) => addr.slug === slug
    );

    if (!address) {
      return res.status(200).json({
        success: false,
        message: "Address not found",
        data: null
      });
    }

    Object.assign(address, req.body);

    if (req.body.isDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = addr.slug === slug;
      });
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};


export const deleteAddress = async (req, res) => {
  try {
    const { slug } = req.params;

    const initialLength = req.user.addresses.length;

    req.user.addresses = req.user.addresses.filter(
      (addr) => addr.slug !== slug
    );

    if (req.user.addresses.length === initialLength) {
      return res.status(200).json({
        success: false,
        message: "Address not found",
        data: null
      });
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Address deleted successfully",
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


export const setDefaultAddress = async (req, res) => {
  try {
    const { slug } = req.params;

    const addressExists = req.user.addresses.some(
      (addr) => addr.slug === slug
    );

    if (!addressExists) {
      return res.status(200).json({
        success: false,
        message: "Address not found",
        data: null
      });
    }

    req.user.addresses.forEach((addr) => {
      addr.isDefault = addr.slug === slug;
    });

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: "Default address updated",
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
