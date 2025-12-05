const { verifyToken } = require('../utils/helpers');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const decoded = verifyToken(token, process.env.JWT_SECRET);
  if (!decoded) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  req.retailer = decoded;
  next();
};

module.exports = { authenticateToken };
