const express = require('express');
const router = express.Router();
const emailFormatController = require('../controllers/emailFormatController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get all email formats
router.get('/', emailFormatController.getAllFormats);

// Get format by ID
router.get('/:id', emailFormatController.getFormatById);

// Create email format
router.post('/', emailFormatController.createFormat);

// Update email format
router.put('/:id', emailFormatController.updateFormat);

// Delete email format
router.delete('/:id', emailFormatController.deleteFormat);

// Send test email
router.post('/:id/test', emailFormatController.testFormat);

module.exports = router;
