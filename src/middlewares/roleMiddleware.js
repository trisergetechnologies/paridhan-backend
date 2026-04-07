export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const activeRole = req.auth?.activeRole || req.user?.role;
    if (!roles.includes(activeRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        data: null
      });
    }

    next();
  };
};
