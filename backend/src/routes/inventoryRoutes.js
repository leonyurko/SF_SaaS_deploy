const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, requireManagerOrAdmin, requireAdmin } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { generateBarcodeMiddleware } = require('../middleware/barcode');
const { uploadSingleImage, uploadMultipleImages, conditionalUploadMultiple, processImageUpload, processMultipleImageUpload } = require('../middleware/upload');

// All routes require authentication
router.use(authenticateToken);

// Get all inventory (all authenticated users)
router.get('/', inventoryController.getAllInventory);

// Get inventory by barcode (all authenticated users)
router.get('/barcode/:code', inventoryController.getInventoryByBarcode);

// Get inventory by ID (all authenticated users)
router.get('/:id', inventoryController.getInventoryById);

// Create inventory (All authenticated users)
router.post(
  '/',
  uploadMultipleImages,
  processMultipleImageUpload,
  validateRequest(schemas.createInventory),
  generateBarcodeMiddleware,
  inventoryController.createInventory
);

// Update inventory (Admin only)
router.put(
  '/:id',
  requireAdmin,
  conditionalUploadMultiple,  // Use conditional middleware instead of uploadMultipleImages
  processMultipleImageUpload,
  validateRequest(schemas.updateInventory),
  inventoryController.updateInventory
);

// Delete inventory (Admin only)
router.delete('/:id', requireAdmin, inventoryController.deleteInventory);

// Update stock (all authenticated users)
router.post(
  '/:id/stock',
  validateRequest(schemas.updateStock),
  inventoryController.updateStock
);

// Regenerate barcode (Admin only)
router.post('/:id/regenerate-barcode', requireAdmin, inventoryController.regenerateBarcode);

module.exports = router;
