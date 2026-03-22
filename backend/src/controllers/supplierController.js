const supplierService = require('../services/supplierService');
const emailFormatService = require('../services/emailFormatService');
const { sendEmail } = require('../services/emailService');

/**
 * Get all suppliers
 * GET /api/suppliers
 */
const getAllSuppliers = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    
    const result = await supplierService.getAllSuppliers(
      { search },
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
 * Get supplier by ID
 * GET /api/suppliers/:id
 */
const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const supplier = await supplierService.getSupplierById(id);

    if (!supplier) {
      return res.status(404).json({
        status: 'error',
        message: 'Supplier not found'
      });
    }

    res.json({
      status: 'success',
      data: { supplier }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create supplier
 * POST /api/suppliers
 */
const createSupplier = async (req, res, next) => {
  try {
    const supplier = await supplierService.createSupplier(req.body);

    res.status(201).json({
      status: 'success',
      data: { supplier }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 */
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingSupplier = await supplierService.getSupplierById(id);
    if (!existingSupplier) {
      return res.status(404).json({
        status: 'error',
        message: 'Supplier not found'
      });
    }

    const supplier = await supplierService.updateSupplier(id, req.body);

    res.json({
      status: 'success',
      data: { supplier }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete supplier
 * DELETE /api/suppliers/:id
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await supplierService.deleteSupplier(id);

    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        message: 'Supplier not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send order email to supplier
 * POST /api/suppliers/:id/order
 */
const sendOrderEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemId, quantity, notes, formatId } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;

    // Get supplier
    const supplier = await supplierService.getSupplierById(id);
    if (!supplier) {
      return res.status(404).json({
        status: 'error',
        message: 'Supplier not found'
      });
    }

    // Get item details if itemId provided
    let itemName = 'Various Items';
    if (itemId) {
      const inventoryService = require('../services/inventoryService');
      const item = await inventoryService.getInventoryById(itemId);
      if (item) {
        itemName = item.name;
      }
    }

    // Process email template
    const emailContent = await emailFormatService.processFormatTemplate(formatId, {
      userName,
      companyName: process.env.COMPANY_NAME || 'Your Company',
      supplierName: supplier.name,
      itemName,
      quantity: quantity || 'N/A',
      notes: notes || '',
      contactPerson: supplier.contact_person || ''
    });

    // Send email (sendEmail expects an array of recipients)
    await sendEmail([supplier.email], emailContent.subject, emailContent.body.replace(/\n/g, '<br>'));

    // Create order record
    const order = await supplierService.createSupplierOrder({
      supplierId: id,
      itemId,
      quantity: quantity || 0,
      notes,
      sentBy: userId
    });

    res.json({
      status: 'success',
      message: 'Order email sent successfully',
      data: { order }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders for a supplier
 * GET /api/suppliers/:id/orders
 */
const getSupplierOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orders = await supplierService.getOrdersBySupplier(id);

    res.json({
      status: 'success',
      data: { orders }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  sendOrderEmail,
  getSupplierOrders
};
