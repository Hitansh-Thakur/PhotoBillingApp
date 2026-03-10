const express = require('express');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const handleValidationErrors = require('../middleware/validationMiddleware');
const billService = require('../services/billService');

const router = express.Router();
router.use(authMiddleware);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product_id required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity required'),
    body('items.*.price').optional().isFloat({ min: 0 }),
    body('imagePath').optional().isString()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { items, imagePath } = req.body;
      const bill = await billService.createBill({
        userId: req.user.userId,
        items,
        imagePath: imagePath || null
      });
      res.status(201).json(bill);
    } catch (err) {
      if (err.message?.includes('not found') || err.message?.includes('Insufficient')) {
        return res.status(400).json({ message: err.message });
      }
      console.error('Create bill error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get('/', async (req, res) => {
  try {
    const bills = await billService.getBills(req.user?.userId);
    res.json(bills);
  } catch (err) {
    console.error('Get bills error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/bills/:billId/items - Get items for a specific bill
router.get('/:billId/items', async (req, res) => {
  try {
    const billId = parseInt(req.params.billId, 10);
    const [items] = await require('../config/db').query(
      `SELECT bi.bill_item_id, bi.product_id, bi.quantity, bi.price, p.name
       FROM bill_items bi
       JOIN products p ON p.product_id = bi.product_id
       WHERE bi.bill_id = ?`,
      [billId]
    );

    res.json(items.map(i => ({
      bill_item_id: i.bill_item_id,
      product_id: i.product_id,
      name: i.name,
      quantity: i.quantity,
      price: parseFloat(i.price)
    })));
  } catch (err) {
    console.error('Get bill items error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/bills/upload - Upload image and create bill in one request
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `bill_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/i;
    const ext = path.extname(file.originalname).slice(1);
    if (allowed.test(ext) || allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, png, webp) allowed'));
    }
  }
});

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const imagePath = `/uploads/${req.file.filename}`;

    // Parse items from request body
    let items;
    try {
      items = JSON.parse(req.body.items || '[]');
    } catch (e) {
      return res.status(400).json({ message: 'Invalid items JSON' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item required' });
    }

    // Create bill with uploaded image
    const bill = await billService.createBill({
      userId: req.user.userId,
      items,
      imagePath
    });

    res.status(201).json(bill);
  } catch (err) {
    if (err.message?.includes('not found') || err.message?.includes('Insufficient')) {
      return res.status(400).json({ message: err.message });
    }
    console.error('Upload and create bill error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
