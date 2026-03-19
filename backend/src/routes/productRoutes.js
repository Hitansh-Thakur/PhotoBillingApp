const express = require("express");
const { body, param } = require("express-validator");
const authMiddleware = require("../middleware/authMiddleware");
const handleValidationErrors = require("../middleware/validationMiddleware");
const productService = require("../services/productService");

const router = express.Router();
router.use(authMiddleware);

// GET /api/products - List all products (with low-stock flag)
router.get("/", async (req, res) => {
  try {
    const products = await productService.getAllProducts(req.user.userId);
    // Annotate low-stock products
    const annotated = products.map(p => ({
      ...p,
      is_low_stock: p.quantity < p.low_stock_threshold,
    }));
    res.json(annotated);
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/products/low-stock - Return products below threshold
router.get("/low-stock", async (req, res) => {
  try {
    const products = await productService.getAllProducts(req.user.userId);
    const lowStock = products.filter(p => p.quantity < p.low_stock_threshold);
    res.json(lowStock);
  } catch (err) {
    console.error("Get low-stock products error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("Invalid product ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await productService.getProductById(
        req.params.id,
        req.user.userId,
      );
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error("Get product error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// POST /api/products - Create product + auto-expense
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name required"),
    body("price").isFloat({ min: 0 }).withMessage("Valid selling price required"),
    body("buying_price").optional().isFloat({ min: 0 }).withMessage("Valid buying price required"),
    body("quantity").optional().isInt({ min: 0 }).withMessage("Quantity must be non-negative"),
    body("low_stock_threshold").optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await productService.createProduct({
        ...req.body,
        userId: req.user.userId,
      });
      res.status(201).json(product);
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({ message: err.message });
      }
      console.error("Create product error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// PUT /api/products/:id/stock - Update product stock quantity
router.put(
  "/:id/stock",
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid product ID"),
    body("quantity").isInt({ min: 0 }).withMessage("Quantity must be non-negative integer"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await productService.updateProduct(
        req.params.id,
        { quantity: req.body.quantity },
        req.user.userId,
      );
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error("Update product stock error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

// PUT /api/products/:id - Update product (name/price/buying_price/quantity/threshold)
router.put(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid product ID"),
    body("name").optional().trim().notEmpty(),
    body("price").optional().isFloat({ min: 0 }),
    body("buying_price").optional().isFloat({ min: 0 }),
    body("quantity").optional().isInt({ min: 0 }),
    body("low_stock_threshold").optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await productService.updateProduct(
        req.params.id,
        req.body,
        req.user.userId,
      );
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (err) {
      console.error("Update product error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.delete(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("Invalid product ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const deleted = await productService.deleteProduct(
        req.params.id,
        req.user.userId,
      );
      if (!deleted)
        return res.status(404).json({ message: "Product not found" });
      res.status(204).send();
    } catch (err) {
      console.error("Delete product error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

module.exports = router;
