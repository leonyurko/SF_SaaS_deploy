const inventoryService = require('../services/inventoryService');
const { generateBothCodes } = require('../services/codeGeneratorService');

/**
 * Get all inventory
 * GET /api/inventory
 */
const getAllInventory = async (req, res, next) => {
  try {
    const { search, category, status, page, limit, warehouse, shelf, shelfColumn, partNumber } = req.query;

    const result = await inventoryService.getAllInventory(
      { search, category, status, warehouse, shelf, shelfColumn, partNumber },
      { page, limit }
    );

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory by ID
 * GET /api/inventory/:id
 */
const getInventoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await inventoryService.getInventoryById(id);

    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Inventory item not found'
      });
    }

    res.json({
      status: 'success',
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory by barcode
 * GET /api/inventory/barcode/:code
 */
const getInventoryByBarcode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const item = await inventoryService.getInventoryByBarcode(code);

    if (!item) {
      return res.status(404).json({
        status: 'error',
        message: 'Inventory item not found with barcode: ' + code
      });
    }

    res.json({
      status: 'success',
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create inventory
 * POST /api/inventory
 */
const createInventory = async (req, res, next) => {
  try {
    const data = req.body;

    // Parse additionalLocations if it's a string (from FormData)
    if (typeof data.additionalLocations === 'string') {
      try {
        data.additionalLocations = JSON.parse(data.additionalLocations);
      } catch (e) {
        console.error('Failed to parse additionalLocations:', e);
        data.additionalLocations = [];
      }
    }

    // Barcode and imageUrl will be added by other middleware/services
    const barcode = req.barcode; // Set by barcode generation middleware
    const imageUrl = req.imageUrl; // Set by image upload middleware
    const imageUrls = req.imageUrls || []; // Multiple images

    // Generate QR code and barcode images
    let codeImages = {};
    try {
      codeImages = await generateBothCodes(barcode, Date.now().toString());
    } catch (codeError) {
      console.error('Error generating codes:', codeError);
      // Continue without code images if generation fails
    }

    const item = await inventoryService.createInventory(
      { ...data, imageUrl, imageUrls },
      barcode,
      codeImages
    );

    res.status(201).json({
      status: 'success',
      data: { item, barcode }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update inventory
 * PUT /api/inventory/:id
 */
const updateInventory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Parse additionalLocations if it's a string (from FormData)
    if (typeof data.additionalLocations === 'string') {
      try {
        data.additionalLocations = JSON.parse(data.additionalLocations);
      } catch (e) {
        console.error('Failed to parse additionalLocations:', e);
        data.additionalLocations = [];
      }
    }

    // Check if item exists
    const existingItem = await inventoryService.getInventoryById(id);
    if (!existingItem) {
      return res.status(404).json({
        status: 'error',
        message: 'Inventory item not found'
      });
    }

    console.log('🔍 Controller - req.body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Controller - data.imageUrl:', data.imageUrl);
    console.log('🔍 Controller - data.imageUrls:', data.imageUrls);

    // Add imageUrl if uploaded
    if (req.imageUrl) {
      data.imageUrl = req.imageUrl;
    }

    // Add multiple images if uploaded or if explicitly set (even if empty)
    if (req.imageUrls && req.imageUrls.length > 0) {
      // Merge with existing images
      const existingImages = existingItem.image_urls || [];
      const allImages = [...existingImages, ...req.imageUrls].slice(0, 5); // Max 5 images
      data.imageUrls = allImages;
    } else if (data.imageUrls !== undefined) {
      // Allow explicit setting of imageUrls (including empty array for deletion)
      // Already set in data from req.body
    }

    console.log('🔍 Controller - data object being sent to service:', JSON.stringify(data, null, 2));

    const item = await inventoryService.updateInventory(id, data);

    res.json({
      status: 'success',
      data: { item }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete inventory
 * DELETE /api/inventory/:id
 */
const deleteInventory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await inventoryService.deleteInventory(id);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Inventory item not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update stock
 * POST /api/inventory/:id/stock
 */
const updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, reason, type, warehouseId } = req.body;
    const userId = req.user.id;

    const result = await inventoryService.updateStock(id, quantity, reason, type, userId, warehouseId);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const regenerateBarcode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await inventoryService.getInventoryById(id);
    if (!item) return res.status(404).json({ status: 'error', message: 'Item not found' });

    const updated = await inventoryService.regenerateBarcodeForItem(id, item.location);
    res.json({ status: 'success', data: { item: updated } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInventory,
  getInventoryById,
  getInventoryByBarcode,
  createInventory,
  updateInventory,
  deleteInventory,
  updateStock,
  regenerateBarcode
};
