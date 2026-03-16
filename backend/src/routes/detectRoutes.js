/**
 * Product detection from image - MOCK implementation.
 * Future: Replace with AI service call.
 */
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const productService = require('../services/productService');

const router = express.Router();
router.use(authMiddleware);

router.post('/products', async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    const count = Math.min(2 + Math.floor(Math.random() * 3), shuffled.length);
    const detected = shuffled.slice(0, count).map(p => ({
      product_id: p.product_id,
      name: p.name,
      price: p.price,
      quantity: 1
    }));
    res.json({ detected });
  } catch (err) {
    console.error('Detect products error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
