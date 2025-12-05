const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const { validateProduct } = require('../utils/validation');

// Get all products with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, search = '' } = req.query;
    const limit = 5;
    const offset = (page - 1) * limit;
    const retailerId = req.retailer.id;

    const connection = await pool.getConnection();

    // Get total count
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM products WHERE retailer_id = ? AND name LIKE ? AND deleted_at IS NULL',
      [retailerId, `%${search}%`]
    );

    // Get products
    const [products] = await connection.query(
      `SELECT id, name, category, image, quantity, price, status, created_at 
       FROM products 
       WHERE retailer_id = ? AND name LIKE ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [retailerId, `%${search}%`, limit, offset]
    );

    connection.release();

    res.json({
      data: products,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit,
        pages: Math.ceil(countResult[0].total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const retailerId = req.retailer.id;

    const connection = await pool.getConnection();
    const [products] = await connection.query(
      'SELECT * FROM products WHERE id = ? AND retailer_id = ? AND deleted_at IS NULL',
      [id, retailerId]
    );
    connection.release();

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Create product
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { error, value } = validateProduct(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, category, quantity, price, status } = value;
    const image = req.file?.filename || null;
    const retailerId = req.retailer.id;
    const productId = uuidv4();

    const connection = await pool.getConnection();
    await connection.query(
      `INSERT INTO products (id, retailer_id, name, category, image, quantity, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, retailerId, name, category, image, quantity, price, status]
    );
    
    // Fetch the created product to return complete data
    const [createdProduct] = await connection.query(
      'SELECT id, name, category, image, quantity, price, status, created_at FROM products WHERE id = ?',
      [productId]
    );
    connection.release();

    res.status(201).json({
      message: 'Product created successfully',
      data: createdProduct[0],
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = validateProduct(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, category, quantity, price, status } = value;
    const retailerId = req.retailer.id;

    const connection = await pool.getConnection();

    // Check if product exists
    const [products] = await connection.query(
      'SELECT image FROM products WHERE id = ? AND retailer_id = ?',
      [id, retailerId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    const image = req.file?.filename || products[0].image;

    await connection.query(
      `UPDATE products SET name = ?, category = ?, image = ?, quantity = ?, price = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND retailer_id = ?`,
      [name, category, image, quantity, price, status, id, retailerId]
    );

    connection.release();

    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Soft delete product
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const retailerId = req.retailer.id;

    const connection = await pool.getConnection();

    // Check if product exists
    const [products] = await connection.query(
      'SELECT id FROM products WHERE id = ? AND retailer_id = ? AND deleted_at IS NULL',
      [id, retailerId]
    );

    if (products.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }

    // Soft delete
    await connection.query(
      'UPDATE products SET deleted_at = NOW() WHERE id = ? AND retailer_id = ?',
      [id, retailerId]
    );

    connection.release();

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
