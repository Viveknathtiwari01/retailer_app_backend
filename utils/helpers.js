const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const generatePassword = () => {
  return crypto.randomBytes(8).toString('hex');
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

const generateToken = (payload, secret, expiresIn) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token, secret) => {
  const jwt = require('jsonwebtoken');
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generatePassword,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
};
