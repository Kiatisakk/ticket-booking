function asyncHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate record detected' });
      }

      if (error.code === 'P2034') {
        return res.status(409).json({ error: 'Conflict detected. Please try again.' });
      }

      console.error(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = asyncHandler;
