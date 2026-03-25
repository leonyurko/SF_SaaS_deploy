const QRCode = require('qrcode');
const { query } = require('../config/database');

/**
 * Generate unique barcode for product
 * Format: WMS-{LOCATION}-{SEQUENCE}
 */
const generateBarcode = async (location = 'WH') => {
  const result = await query('SELECT COUNT(*) as count FROM inventory');
  const count = parseInt(result.rows[0].count) + 1;
  const prefix = `WMS-${location.substring(0, 1).toUpperCase()}`;

  // Increment sequence until a free slot is found (keeps barcode short and clean)
  for (let i = 0; i < 10000; i++) {
    const sequence = (count + i).toString().padStart(3, '0');
    const barcode = `${prefix}-${sequence}`;
    const existing = await query('SELECT id FROM inventory WHERE barcode = $1', [barcode]);
    if (existing.rows.length === 0) return barcode;
  }

  // Absolute fallback: short 4-char random suffix (max ~12 chars total)
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

/**
 * Generate QR code image from data
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<Buffer>} QR code image buffer
 */
const generateQRCodeImage = async (data) => {
  try {
    const qrCodeBuffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 1
    });
    return qrCodeBuffer;
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + error.message);
  }
};

/**
 * Generate QR code as data URL
 * @param {string} data - Data to encode in QR code
 * @returns {Promise<string>} QR code data URL
 */
const generateQRCodeDataURL = async (data) => {
  try {
    const dataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 1
    });
    return dataURL;
  } catch (error) {
    throw new Error('Failed to generate QR code: ' + error.message);
  }
};

/**
 * Validate barcode format
 * @param {string} barcode
 * @returns {boolean}
 */
const validateBarcode = (barcode) => {
  // Basic validation: should start with WMS- and have proper format
  const pattern = /^WMS-[A-Z]-\d{3}(-\d+)?$/;
  return pattern.test(barcode);
};

module.exports = {
  generateBarcode,
  generateQRCodeImage,
  generateQRCodeDataURL,
  validateBarcode
};
