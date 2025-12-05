const Joi = require('joi');

const retailerRegistrationSchema = Joi.object({
  firstName: Joi.string().required().messages({
    'string.empty': 'First name is required',
  }),
  lastName: Joi.string().required().messages({
    'string.empty': 'Last name is required',
  }),
  companyName: Joi.string().required().messages({
    'string.empty': 'Company name is required',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Valid email is required',
    'string.empty': 'Email is required',
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{10,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone must contain only numbers (minimum 10 digits)',
      'string.empty': 'Phone is required',
    }),
  address: Joi.string().required().messages({
    'string.empty': 'Address is required',
  }),
});

const productSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Product name is required',
  }),
  category: Joi.string().required().messages({
    'string.empty': 'Category is required',
  }),
  quantity: Joi.number().integer().min(0).required().messages({
    'number.base': 'Quantity must be a number',
    'number.integer': 'Quantity must be an integer',
  }),
  price: Joi.number().min(0).required().messages({
    'number.base': 'Price must be a number',
  }),
  status: Joi.string().valid('draft', 'published').required().messages({
    'any.only': 'Status must be either draft or published',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Valid email is required',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

const validateRetailerRegistration = (data) => {
  return retailerRegistrationSchema.validate(data);
};

const validateProduct = (data) => {
  return productSchema.validate(data);
};

const validateLogin = (data) => {
  return loginSchema.validate(data);
};

module.exports = {
  validateRetailerRegistration,
  validateProduct,
  validateLogin,
};
