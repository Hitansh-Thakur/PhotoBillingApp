/**
 * Product detection from image — real YOLOv8 implementation.
 * Forwards uploaded image to Python FastAPI YOLO service, then matches
 * detected class labels against the user's products in MySQL.
 */
const express  = require('express');
const multer   = require('multer');
const fetch    = require('node-fetch');
const FormData = require('form-data');
const authMiddleware = require('../middleware/authMiddleware');
const labelMap = require('../config/yoloLabelMap.json');
const pool     = require('../config/db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
router.use(authMiddleware);

const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:8000/detect';

/**
 * Find a product in the DB using the YOLO label.
 * Priority: yolo_label exact match → keyword LIKE match via labelMap.
 */
async function findProductByLabel(label, userId) {
  console.log(`[YOLO] Searching for label="${label}" userId=${userId}`);

  // 1. Try exact yolo_label column match (if column exists)
  try {
    const [exactRows] = await pool.query(
      `SELECT product_id, name, price FROM products
       WHERE user_id = ? AND yolo_label = ? LIMIT 1`,
      [userId, label]
    );
    if (exactRows.length > 0) {
      console.log(`[YOLO] Matched via yolo_label column: "${exactRows[0].name}"`);
      return exactRows[0];
    }
  } catch (_) {
    // yolo_label column may not exist yet — fall through
  }

  // 2. Try exact name match (label === product name)
  const [exactNameRows] = await pool.query(
    `SELECT product_id, name, price FROM products
     WHERE user_id = ? AND LOWER(name) = ? LIMIT 1`,
    [userId, label.toLowerCase()]
  );
  if (exactNameRows.length > 0) {
    console.log(`[YOLO] Matched via exact name: "${exactNameRows[0].name}"`);
    return exactNameRows[0];
  }

  // 3. LIKE / keyword match (escape SQL wildcards in keyword)
  const rawKeyword = (labelMap[label] || label).toLowerCase();
  const keyword = rawKeyword.replace(/_/g, '\\_').replace(/%/g, '\\%');
  console.log(`[YOLO] Trying LIKE '%${keyword}%' for userId=${userId}`);

  const [rows] = await pool.query(
    `SELECT product_id, name, price FROM products
     WHERE user_id = ? AND LOWER(name) LIKE ? ESCAPE '\\\\' LIMIT 1`,
    [userId, `%${keyword}%`]
  );

  if (rows.length > 0) {
    console.log(`[YOLO] Matched via LIKE: "${rows[0].name}"`);
  } else {
    // 4. Last resort: search across ALL products for this user to debug
    const [allRows] = await pool.query(
      `SELECT product_id, name FROM products WHERE user_id = ? LIMIT 10`,
      [userId]
    );
    console.log(`[YOLO] No match found. Products for userId=${userId}:`, allRows.map(r => r.name));
  }

  return rows[0] || null;
}


router.post('/products', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    // 1. Forward image to Python YOLO service
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'image.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    const yoloRes  = await fetch(YOLO_SERVICE_URL, { method: 'POST', body: form });
    const yoloData = await yoloRes.json();
    const detections = yoloData.detections || [];   // [{ label, confidence }]

    console.log(`[YOLO] Detections: ${JSON.stringify(detections)}`);

    // 2. Match each detection to a product in DB
    const userId  = req.user.userId;
    const matched = [];

    for (const det of detections) {
      const product = await findProductByLabel(det.label, userId);
      if (product) {
        matched.push({
          product_id: product.product_id,
          name:       product.name,
          price:      product.price,
          quantity:   1,
          confidence: det.confidence,
          yolo_label: det.label,
        });
      } else {
        console.log(`[YOLO] No product found for label: "${det.label}"`);
      }
    }

    // 3. Return matched products
    res.json({ detected: matched });

  } catch (err) {
    console.error('Detect products error:', err);
    // Graceful fallback: return empty list so app can handle
    res.status(500).json({ message: 'Detection service unavailable', detected: [] });
  }
});

module.exports = router;
