const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../config/db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const YOLO_SERVICE_URL =
	process.env.YOLO_SERVICE_URL || "http://localhost:8000/detect";

router.use(authMiddleware);

function normalizeLabel(label) {
	return String(label || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s_-]+/g, " ")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compactText(text) {
	return normalizeLabel(text).replace(/\s+/g, "");
}

function scoreProductMatch(label, productName) {
	const normalizedLabel = normalizeLabel(label);
	const normalizedName = normalizeLabel(productName);
	if (!normalizedLabel || !normalizedName) return 0;

	if (normalizedLabel === normalizedName) return 1;

	const compactLabel = compactText(normalizedLabel);
	const compactName = compactText(normalizedName);
	if (compactLabel && compactLabel === compactName) return 0.98;

	let score = 0;
	if (
		normalizedName.includes(normalizedLabel) ||
		normalizedLabel.includes(normalizedName)
	) {
		score += 0.45;
	}

	const labelTokens = normalizedLabel.split(" ").filter(Boolean);
	const nameTokens = normalizedName.split(" ").filter(Boolean);
	if (labelTokens.length === 0 || nameTokens.length === 0) return score;

	const nameTokenSet = new Set(nameTokens);
	const overlap = labelTokens.filter((token) =>
		nameTokenSet.has(token),
	).length;
	score += 0.5 * (overlap / Math.max(labelTokens.length, nameTokens.length));

	return Math.min(score, 0.99);
}

async function findProductByLabel(label, products) {
	const normalizedLabel = normalizeLabel(label);
	if (!normalizedLabel || !Array.isArray(products) || products.length === 0) {
		return null;
	}

	let best = null;
	let bestScore = 0;
	for (const product of products) {
		const score = scoreProductMatch(normalizedLabel, product.name);
		if (score > bestScore) {
			bestScore = score;
			best = product;
		}
	}

	// Require a minimum confidence to avoid random wrong matches.
	return bestScore >= 0.35 ? best : null;
}

router.post("/products", upload.single("image"), async (req, res) => {
	try {
		if (!req.file) {
			return res
				.status(400)
				.json({ message: "No image provided", detected: [] });
		}

		const form = new FormData();
		form.append("file", req.file.buffer, {
			filename: req.file.originalname || "image.jpg",
			contentType: req.file.mimetype || "image/jpeg",
		});

		const yoloRes = await fetch(YOLO_SERVICE_URL, {
			method: "POST",
			body: form,
			headers: form.getHeaders(),
		});

		if (!yoloRes.ok) {
			const details = await yoloRes.text();
			throw new Error(
				`YOLO service request failed: ${yoloRes.status} ${details}`,
			);
		}

		const yoloData = await yoloRes.json();
		const detections = Array.isArray(yoloData?.detections)
			? yoloData.detections
			: [];
		const userId = req.user.userId;
		const [products] = await pool.query(
			`SELECT product_id, name, price
       FROM products
       WHERE user_id = ?`,
			[userId],
		);
		const seenProductIds = new Set();
		const matched = [];

		for (const detection of detections) {
			const label = detection?.label;
			if (!label) continue;

			const product = await findProductByLabel(label, products);
			if (!product || seenProductIds.has(product.product_id)) continue;

			seenProductIds.add(product.product_id);
			matched.push({
				product_id: product.product_id,
				name: product.name,
				price: Number(product.price) || 0,
				quantity: 1,
			});
		}

		return res.json({ detected: matched });
	} catch (err) {
		console.error("Detect products error:", err);
		return res.status(502).json({
			message: "Detection service unavailable",
			detected: [],
		});
	}
});

module.exports = router;
