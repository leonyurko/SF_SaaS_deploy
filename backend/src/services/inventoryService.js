const { query, transaction } = require('../config/database');

/**
 * Get all inventory with filters and pagination
 */
const getAllInventory = async (filters = {}, pagination = {}) => {
  const { search, category, status, page = 1, limit = 50 } = { ...filters, ...pagination };
  const offset = (page - 1) * limit;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  // Search filter
  if (search) {
    whereConditions.push(`(i.name ILIKE $${paramCount} OR i.barcode ILIKE $${paramCount} OR i.location ILIKE $${paramCount})`);
    params.push(`%${search}%`);
    paramCount++;
  }

  // Category filter
  if (category) {
    whereConditions.push(`i.category_id = $${paramCount}`);
    params.push(category);
    paramCount++;
  }

  // Status filter - accept both short and full format
  if (status) {
    const statusLower = status.toLowerCase();
    if (statusLower === 'low' || statusLower === 'low stock') {
      whereConditions.push('i.current_stock <= i.min_threshold AND i.current_stock > 0');
    } else if (statusLower === 'out' || statusLower === 'out of stock') {
      whereConditions.push('i.current_stock = 0');
    } else if (statusLower === 'in' || statusLower === 'in stock') {
      whereConditions.push('i.current_stock > i.min_threshold');
    }
  }

  // Warehouse filter (Now using warehouse_id)
  if (filters.warehouse) {
    whereConditions.push(`i.warehouse_id = $${paramCount}`);
    params.push(filters.warehouse);
    paramCount++;
  }

  // Shelf/Column filters (Removed/Merged)
  if (filters.shelf || filters.shelfColumn) {
    const locSearch = [filters.shelf, filters.shelfColumn].filter(Boolean).join(' ');
    if (locSearch) {
      whereConditions.push(`i.location ILIKE $${paramCount}`);
      params.push(`%${locSearch}%`);
      paramCount++;
    }
  }

  // Specific Location filter (New)
  if (filters.location) {
    whereConditions.push(`i.location ILIKE $${paramCount}`);
    params.push(`%${filters.location}%`);
    paramCount++;
  }

  // Part Number filter (Barcode or Name)
  if (filters.partNumber) {
    whereConditions.push(`(i.barcode ILIKE $${paramCount} OR i.name ILIKE $${paramCount})`);
    params.push(`%${filters.partNumber}%`);
    paramCount++;
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM inventory i ${whereClause}`;
  const countResult = await query(countQuery, params);
  const total = parseInt(countResult.rows[0].total);

  // Get paginated results
  params.push(limit, offset);
  const dataQuery = `
    SELECT 
      i.*,
      c.name as category_name,
      sc.name as sub_category_name,
      w.name as warehouse_name,
      (
        SELECT json_agg(json_build_object(
          'id', iw.id,
          'warehouse_id', iw.warehouse_id,
          'warehouse_name', w2.name,
          'location', iw.location,
          'quantity', iw.quantity
        ))
        FROM item_warehouses iw
        LEFT JOIN warehouses w2 ON iw.warehouse_id = w2.id
        WHERE iw.inventory_id = i.id AND iw.warehouse_id IS NOT NULL
      ) as stock_locations,
      CASE 
        WHEN i.current_stock = 0 THEN 'Out of Stock'
        WHEN i.current_stock <= i.min_threshold THEN 'Low Stock'
        ELSE 'In Stock'
      END as status
    FROM inventory i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN categories sc ON i.sub_category_id = sc.id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    ${whereClause}
    ORDER BY i.updated_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `;

  const result = await query(dataQuery, params);

  return {
    items: result.rows,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit)
  };
};

/**
 * Get inventory item by ID
 */
const getInventoryById = async (id) => {
  const result = await query(
    `SELECT 
      i.*,
      c.name as category_name,
      sc.name as sub_category_name,
      w.name as warehouse_name,
      (
        SELECT json_agg(json_build_object(
          'id', iw.id,
          'warehouse_id', iw.warehouse_id,
          'warehouse_name', w2.name,
          'location', iw.location,
          'quantity', iw.quantity
        ))
        FROM item_warehouses iw
        LEFT JOIN warehouses w2 ON iw.warehouse_id = w2.id
        WHERE iw.inventory_id = i.id AND iw.warehouse_id IS NOT NULL
      ) as stock_locations,
      CASE 
        WHEN i.current_stock = 0 THEN 'Out of Stock'
        WHEN i.current_stock <= i.min_threshold THEN 'Low Stock'
        ELSE 'In Stock'
      END as status
    FROM inventory i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN categories sc ON i.sub_category_id = sc.id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Get inventory item by barcode
 */
const getInventoryByBarcode = async (barcode) => {
  const result = await query(
    `SELECT 
      i.*,
      c.name as category_name,
      sc.name as sub_category_name,
      w.name as warehouse_name,
      (
        SELECT json_agg(json_build_object(
          'id', iw.id,
          'warehouse_id', iw.warehouse_id,
          'warehouse_name', w2.name,
          'location', iw.location,
          'quantity', iw.quantity
        ))
        FROM item_warehouses iw
        LEFT JOIN warehouses w2 ON iw.warehouse_id = w2.id
        WHERE iw.inventory_id = i.id AND iw.warehouse_id IS NOT NULL
      ) as stock_locations,
      CASE 
        WHEN i.current_stock = 0 THEN 'Out of Stock'
        WHEN i.current_stock <= i.min_threshold THEN 'Low Stock'
        ELSE 'In Stock'
      END as status
    FROM inventory i
    LEFT JOIN categories c ON i.category_id = c.id
    LEFT JOIN categories sc ON i.sub_category_id = sc.id
    LEFT JOIN warehouses w ON i.warehouse_id = w.id
    WHERE i.barcode = $1`,
    [barcode]
  );
  return result.rows[0] || null;
};

/**
 * Create new inventory item
 */
const createInventory = async (data, barcode, codeImages = {}) => {
  const {
    name,
    location,
    warehouseId,
    categoryId,
    subCategoryId,
    description,
    imageUrl,
    imageUrls,
    currentStock,
    minThreshold
  } = data;

  const { qrImageUrl, barcodeImageUrl } = codeImages;

  const result = await query(
    `INSERT INTO inventory 
      (name, location, warehouse_id, category_id, sub_category_id, description, image_url, image_urls, barcode, barcode_image_url, qr_image_url, current_stock, min_threshold, additional_locations, location_details)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      name,
      location,
      warehouseId || null,
      categoryId || null,
      subCategoryId || null,
      description || null,
      imageUrl || null,
      imageUrls ? JSON.stringify(imageUrls) : '[]',
      barcode,
      barcodeImageUrl || null,
      qrImageUrl || null,
      currentStock,
      minThreshold || 10,
      JSON.stringify(data.additionalLocations || []),
      data.locationDetails || null
    ]
  );

  const newItem = result.rows[0];

  // Insert initial stock into item_warehouses if warehouseId provided
  if (warehouseId) {
    await query(
      `INSERT INTO item_warehouses (inventory_id, warehouse_id, quantity, location)
       VALUES ($1, $2, $3, $4)`,
      [newItem.id, warehouseId, currentStock || 0, location]
    );
  }

  // Handle Additional Locations
  if (data.additionalLocations) {
    let extras = [];
    try {
      extras = typeof data.additionalLocations === 'string'
        ? JSON.parse(data.additionalLocations)
        : data.additionalLocations;
    } catch (e) {
      console.error('Error parsing additionalLocations for create:', e);
    }

    if (Array.isArray(extras)) {
      for (const loc of extras) {
        if (!loc.warehouseId) continue;
        // Skip if same as primary (already handled)
        if (loc.warehouseId === warehouseId) continue;

        await query(
          `INSERT INTO item_warehouses (inventory_id, warehouse_id, quantity, location)
           VALUES ($1, $2, $3, $4)`,
          [newItem.id, loc.warehouseId, 0, loc.location || '']
        );
      }
    }
  }

  return newItem;
};

/**
 * Update inventory item
 */
const updateInventory = async (id, data) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  // Fetch current item state before update to handle item_warehouses sync
  const oldItemResult = await query('SELECT * FROM inventory WHERE id = $1', [id]);
  const oldItem = oldItemResult.rows[0];

  if (!oldItem) {
    throw new Error('Item not found');
  }

  if (data.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.location !== undefined) {
    fields.push(`location = $${paramCount++}`);
    values.push(data.location);
  }
  if (data.warehouseId !== undefined) {
    fields.push(`warehouse_id = $${paramCount++}`);
    values.push(data.warehouseId || null);
  }
  if (data.categoryId !== undefined) {
    fields.push(`category_id = $${paramCount++}`);
    values.push(data.categoryId || null);
  }
  if (data.subCategoryId !== undefined) {
    fields.push(`sub_category_id = $${paramCount++}`);
    values.push(data.subCategoryId || null);
  }
  if (data.additionalLocations !== undefined) {
    fields.push(`additional_locations = $${paramCount++}`);
    values.push(JSON.stringify(data.additionalLocations || []));
  }
  if (data.locationDetails !== undefined) {
    fields.push(`location_details = $${paramCount++}`);
    values.push(data.locationDetails || null);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(data.description || null);
  }
  if (data.imageUrl !== undefined) {
    fields.push(`image_url = $${paramCount++}`);
    values.push(data.imageUrl || null);
  }
  if (data.imageUrls !== undefined) {
    fields.push(`image_urls = $${paramCount++}`);
    values.push(JSON.stringify(data.imageUrls));
  }
  if (data.minThreshold !== undefined) {
    fields.push(`min_threshold = $${paramCount++}`);
    values.push(data.minThreshold);
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);

  const result = await query(
    `UPDATE inventory SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  const updatedItem = result.rows[0];

  // Sync item_warehouses if primary warehouse/location changed
  if (
    (data.warehouseId !== undefined && data.warehouseId !== oldItem.warehouse_id) ||
    (data.location !== undefined && data.location !== oldItem.location)
  ) {
    const oldWarehouseId = oldItem.warehouse_id;
    const newWarehouseId = updatedItem.warehouse_id;
    const newLocation = updatedItem.location;

    if (oldWarehouseId && newWarehouseId && oldWarehouseId !== newWarehouseId) {
      // Warehouse changed: Move stock
      const existingTarget = await query(
        'SELECT * FROM item_warehouses WHERE inventory_id = $1 AND warehouse_id = $2',
        [id, newWarehouseId]
      );

      if (existingTarget.rows.length > 0) {
        // Target exists: Merge
        const oldEntry = await query(
          'SELECT quantity FROM item_warehouses WHERE inventory_id = $1 AND warehouse_id = $2',
          [id, oldWarehouseId]
        );

        if (oldEntry.rows.length > 0) {
          const qtyToAdd = oldEntry.rows[0].quantity;
          await query(
            'UPDATE item_warehouses SET quantity = quantity + $1 WHERE id = $2',
            [qtyToAdd, existingTarget.rows[0].id]
          );
          await query(
            'DELETE FROM item_warehouses WHERE inventory_id = $1 AND warehouse_id = $2',
            [id, oldWarehouseId]
          );
        }
      } else {
        // Target does not exist: Update (Move)
        await query(
          'UPDATE item_warehouses SET warehouse_id = $1, location = $2 WHERE inventory_id = $3 AND warehouse_id = $4',
          [newWarehouseId, newLocation, id, oldWarehouseId]
        );
      }
    } else if (oldWarehouseId === newWarehouseId && data.location !== undefined) {
      // Only location changed
      await query(
        'UPDATE item_warehouses SET location = $1 WHERE inventory_id = $2 AND warehouse_id = $3',
        [newLocation, id, newWarehouseId]
      );
    } else if (!oldWarehouseId && newWarehouseId) {
      // Was orphan, now assigned
      await query(
        `INSERT INTO item_warehouses (inventory_id, warehouse_id, quantity, location)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (inventory_id, warehouse_id) DO UPDATE SET location = $4`,
        [id, newWarehouseId, updatedItem.current_stock || 0, newLocation]
      );
    }
  }

  // 4. Handle Additional Locations with Full Reconciliation
  const validWarehouseIds = [];
  if (updatedItem.warehouse_id) validWarehouseIds.push(updatedItem.warehouse_id);

  if (data.additionalLocations) {
    let extras = [];
    try {
      extras = typeof data.additionalLocations === 'string'
        ? JSON.parse(data.additionalLocations)
        : data.additionalLocations;
    } catch (e) {
      console.error('Error parsing additionalLocations for sync:', e);
    }

    if (Array.isArray(extras)) {
      for (const loc of extras) {
        if (!loc.warehouseId) continue;

        validWarehouseIds.push(loc.warehouseId);

        // Skip if same as primary (already handled)
        if (loc.warehouseId === updatedItem.warehouse_id) continue;

        const updateExtraQuery = `
           INSERT INTO item_warehouses (inventory_id, warehouse_id, location, quantity)
           VALUES ($1, $2, $3, 0)
           ON CONFLICT (inventory_id, warehouse_id) 
           DO UPDATE SET location = EXCLUDED.location
         `;
        await query(updateExtraQuery, [id, loc.warehouseId, loc.location || '']);
      }
    }
  }

  // RECONCILIATION: Delete any warehouse entries that are NOT in the valid list
  if (validWarehouseIds.length > 0) {
    await query(
      `DELETE FROM item_warehouses 
       WHERE inventory_id = $1 
       AND (warehouse_id IS NULL OR NOT (warehouse_id = ANY($2)))`,
      [id, validWarehouseIds]
    );
  } else {
    // Fallback cleanup
    await query('DELETE FROM item_warehouses WHERE inventory_id = $1 AND warehouse_id IS NULL', [id]);
  }

  return updatedItem;
};

/**
 * Delete inventory item
 */
const deleteInventory = async (id) => {
  const result = await query('DELETE FROM inventory WHERE id = $1', [id]);
  return result.rowCount > 0;
};

/**
 * Update stock and create transaction
 */
const updateStock = async (id, quantity, reason, type, userId, warehouseId = null) => {
  return await transaction(async (client) => {
    // Get current item
    const itemResult = await client.query('SELECT * FROM inventory WHERE id = $1', [id]);
    const item = itemResult.rows[0];

    if (!item) {
      throw new Error('Item not found');
    }

    // Determine which warehouse to update
    // If warehouseId is provided, use it.
    // If not, fallback to item's default warehouse_id 
    const targetWarehouseId = warehouseId || item.warehouse_id;

    if (!targetWarehouseId) {
      throw new Error('No warehouse specified for stock update');
    }

    // Check/Get current stock in that warehouse
    const warehouseStockResult = await client.query(
      'SELECT * FROM item_warehouses WHERE inventory_id = $1 AND warehouse_id = $2',
      [id, targetWarehouseId]
    );

    let currentWarehouseStock = 0;
    let locationInWarehouse = item.location; // Default fallback

    if (warehouseStockResult.rows.length > 0) {
      currentWarehouseStock = warehouseStockResult.rows[0].quantity;
      locationInWarehouse = warehouseStockResult.rows[0].location;
    }

    // Calculate new stock for specific warehouse
    let newWarehouseStock = currentWarehouseStock;
    if (type === 'addition') {
      newWarehouseStock += quantity;
    } else if (type === 'deduction') {
      newWarehouseStock -= quantity;
      if (newWarehouseStock < 0) {
        throw new Error(`Insufficient stock in selected warehouse (Current: ${currentWarehouseStock})`);
      }
    }

    // Update item_warehouses
    await client.query(
      `INSERT INTO item_warehouses (inventory_id, warehouse_id, quantity, location)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (inventory_id, warehouse_id) 
         DO UPDATE SET quantity = $3`,
      [id, targetWarehouseId, newWarehouseStock, locationInWarehouse]
    );

    // Trigger in DB will update inventory.current_stock automatically.
    // Fetch updated item to return
    const updatedItemResult = await client.query('SELECT * FROM inventory WHERE id = $1', [id]);

    // Create transaction record
    const transactionResult = await client.query(
      `INSERT INTO transactions (item_id, user_id, quantity, reason, transaction_type, warehouse_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, quantity, reason, type, targetWarehouseId]
    );

    return {
      item: updatedItemResult.rows[0],
      transaction: transactionResult.rows[0]
    };
  });
};

/**
 * Get low stock items
 */
const getLowStockItems = async () => {
  const queryStr = `
        SELECT 
          i.id,
          i.name,
          i.location,
          w.name as warehouse_name,
          i.current_stock,
          i.min_threshold,
          c.name as category_name,
          sc.name as sub_category_name
        FROM inventory i
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN categories sc ON i.sub_category_id = sc.id
        LEFT JOIN warehouses w ON i.warehouse_id = w.id
        WHERE i.current_stock <= i.min_threshold
        ORDER BY i.current_stock ASC
    `;
  const result = await query(queryStr);
  return result.rows;
};

const regenerateBarcodeForItem = async (itemId, location) => {
  const { generateBarcode } = require('./barcodeService');
  const { generateBothCodes } = require('./codeGeneratorService');

  const barcode = await generateBarcode(location || 'WH');
  const codeImages = await generateBothCodes(barcode, Date.now().toString());

  const result = await query(
    `UPDATE inventory SET barcode = $1, barcode_image_url = $2, qr_image_url = $3 WHERE id = $4 RETURNING *`,
    [barcode, codeImages.barcodeImageUrl, codeImages.qrImageUrl, itemId]
  );
  return result.rows[0];
};

module.exports = {
  getAllInventory,
  getInventoryById,
  getInventoryByBarcode,
  createInventory,
  updateInventory,
  deleteInventory,
  updateStock,
  getLowStockItems,
  regenerateBarcodeForItem
};
