const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const {
  validateRetailerRegistration,
  validateLogin,
} = require('../utils/validation');
const {
  generatePassword,
  hashPassword,
  comparePassword,
  generateToken,
} = require('../utils/helpers');
const { sendEmail } = require('../config/email');
require('dotenv').config();

// Register Retailer
router.post('/register', upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const { error, value } = validateRetailerRegistration(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { firstName, lastName, companyName, email, phone, address } = value;
    const companyLogo = req.files?.companyLogo?.[0]?.filename || null;
    const profileImage = req.files?.profileImage?.[0]?.filename || null;

    // Check if email already exists
    const connection = await pool.getConnection();
    const [existingRetailer] = await connection.query(
      'SELECT id FROM retailers WHERE email = ?',
      [email]
    );

    if (existingRetailer.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate password and hash it
    const generatedPassword = generatePassword();
    const hashedPassword = await hashPassword(generatedPassword);
    const retailerId = uuidv4();

    // Send email with login details FIRST (before saving to database)
    const emailHtml = `
      <h2>Welcome to Retailer Dashboard</h2>
      <p>Dear ${firstName} ${lastName},</p>
      <p>Your account has been successfully created.</p>
      <p><strong>Login Details:</strong></p>
      <p>Email: ${email}</p>
      <p>Password: ${generatedPassword}</p>
      <p>Please change your password after logging in.</p>
    `;
    console.log("--------------------------------")
    try {
      await sendEmail(email, 'Your Retailer Account Details', emailHtml);
    } catch (emailError) {
      console.log("emailError", emailError)
      console.error('Email sending failed:', emailError);
      connection.release();
      return res.status(500).json({ error: 'Failed to send email. Please check your email configuration.' });
    }

    // Insert retailer ONLY after email is sent successfully
    await connection.query(
      `INSERT INTO retailers (id, first_name, last_name, company_name, email, phone, address, company_logo, profile_image, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [retailerId, firstName, lastName, companyName, email, phone, address, companyLogo, profileImage, hashedPassword]
    );

    connection.release();

    res.status(201).json({
      message: 'Retailer registered successfully. Check your email for login details.',
      retailerId: retailerId,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { error, value } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    const connection = await pool.getConnection();
    const [retailers] = await connection.query(
      'SELECT id, first_name, last_name, company_name, email, password, company_logo, profile_image FROM retailers WHERE email = ?',
      [email]
    );
    connection.release();

    if (retailers.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const retailer = retailers[0];
    const isPasswordValid = await comparePassword(password, retailer.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(
      { id: retailer.id, email: retailer.email },
      process.env.JWT_SECRET,
      process.env.JWT_EXPIRY || '7d'
    );

    res.json({
      message: 'Login successful',
      token,
      retailer: {
        id: retailer.id,
        firstName: retailer.first_name,
        lastName: retailer.last_name,
        companyName: retailer.company_name,
        email: retailer.email,
        phone: retailer.phone,
        address: retailer.address,
        companyLogo: retailer.company_logo,
        profileImage: retailer.profile_image,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update Retailer Profile
router.put('/profile', authenticateToken, upload.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 },
]), async (req, res) => {
  try {
    const retailerId = req.retailer.id;
    const { firstName, lastName, companyName, phone, address } = req.body;
    
    const connection = await pool.getConnection();
    
    // Check if retailer exists
    const [existingRetailer] = await connection.query(
      'SELECT * FROM retailers WHERE id = ?',
      [retailerId]
    );
    
    if (existingRetailer.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Retailer not found' });
    }
    
    // Build update query dynamically - only update provided fields
    let updateQuery = 'UPDATE retailers SET updated_at = CURRENT_TIMESTAMP';
    let updateParams = [];
    
    if (firstName && firstName.trim()) {
      updateQuery += ', first_name = ?';
      updateParams.push(firstName);
    }
    
    if (lastName && lastName.trim()) {
      updateQuery += ', last_name = ?';
      updateParams.push(lastName);
    }
    
    if (companyName && companyName.trim()) {
      updateQuery += ', company_name = ?';
      updateParams.push(companyName);
    }
    
    if (phone && phone.trim()) {
      updateQuery += ', phone = ?';
      updateParams.push(phone);
    }
    
    if (address && address.trim()) {
      updateQuery += ', address = ?';
      updateParams.push(address);
    }
    
    // Handle file updates
    if (req.files && req.files.companyLogo && req.files.companyLogo[0]) {
      updateQuery += ', company_logo = ?';
      updateParams.push(req.files.companyLogo[0].filename);
    }
    
    if (req.files && req.files.profileImage && req.files.profileImage[0]) {
      updateQuery += ', profile_image = ?';
      updateParams.push(req.files.profileImage[0].filename);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(retailerId);
    
    await connection.query(updateQuery, updateParams);
    
    // Get updated retailer data
    const [updatedRetailer] = await connection.query(
      'SELECT id, first_name, last_name, company_name, email, phone, address, company_logo, profile_image, created_at, updated_at FROM retailers WHERE id = ?',
      [retailerId]
    );
    
    connection.release();
    
    res.json({
      message: 'Profile updated successfully',
      retailer: {
        id: updatedRetailer[0].id,
        firstName: updatedRetailer[0].first_name,
        lastName: updatedRetailer[0].last_name,
        companyName: updatedRetailer[0].company_name,
        email: updatedRetailer[0].email,
        phone: updatedRetailer[0].phone,
        address: updatedRetailer[0].address,
        companyLogo: updatedRetailer[0].company_logo,
        profileImage: updatedRetailer[0].profile_image,
        createdAt: updatedRetailer[0].created_at,
        updatedAt: updatedRetailer[0].updated_at,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Forgot Password - resend auto-generated password to retailer email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const connection = await pool.getConnection();

    // Find retailer by email
    const [rows] = await connection.query(
      'SELECT * FROM retailers WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'No retailer found with this email' });
    }

    const retailer = rows[0];

    // Generate new password and hash it
    const plainPassword = generatePassword();
    const hashedPassword = await hashPassword(plainPassword);

    // Update password in database
    await connection.query(
      'UPDATE retailers SET password = ? WHERE id = ?',
      [hashedPassword, retailer.id]
    );

    connection.release();

    // Send email with new password (use same helper signature as registration)
    const resetHtml = `
      <h2>Password Reset</h2>
      <p>Dear ${retailer.first_name} ${retailer.last_name || ''},</p>
      <p>Your retailer account password has been reset.</p>
      <p><strong>New password:</strong> ${plainPassword}</p>
      <p>Please log in with this password and change it after logging in.</p>
    `;

    await sendEmail(retailer.email, 'Your new retailer account password', resetHtml);

    res.json({ message: 'A new password has been sent to your email address' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Change password (retailer must confirm current password)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const retailerId = req.retailer.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Basic strong password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      });
    }

    const connection = await pool.getConnection();

    // Get current hashed password
    const [rows] = await connection.query(
      'SELECT password FROM retailers WHERE id = ?',
      [retailerId]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Retailer not found' });
    }

    const retailer = rows[0];

    // Verify current password
    const isCurrentValid = await comparePassword(currentPassword, retailer.password);
    if (!isCurrentValid) {
      connection.release();
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and save
    const hashedNewPassword = await hashPassword(newPassword);

    await connection.query(
      'UPDATE retailers SET password = ? WHERE id = ?',
      [hashedNewPassword, retailerId]
    );

    connection.release();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
