export const parsePagination = (req, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  let limit = Number(req.query.limit) || defaultLimit;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  limit = Math.min(Math.floor(limit), maxLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};
