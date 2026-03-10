# YOLOv8 Integration Plan — Photo Billing App

## 1. Project Overview & Current State

| Layer | Tech | Status |
|---|---|---|
| Mobile Frontend | React Native (Expo) | ✅ Working |
| Backend API | Node.js + Express + MySQL | ✅ Working |
| Product Detection | **MOCK** (random products) | ⚠️ Needs real AI |
| YOLOv8 Inference | `best.pt` (fine-tuned FMCG model) | 🔴 Not integrated |

### Current Detection Flow (Mock)
```
Camera → takePicture() → uploadImage() → getMockDetectedProducts() → bill-edit.tsx
```
The `detectRoutes.js` file at `/api/detect/products` currently returns **random shuffled products** from the DB — it does **not** actually analyze the image.

The `camera.tsx` also calls `getMockDetectedProducts()` directly on the frontend (from `data/mockData.ts`) **before** even calling the detect API.

---

## 2. Goal

Replace the mock detection with a real YOLOv8 pipeline:

```
Camera → takePicture() → Upload image to Node.js
    → Node.js forwards image to Python YOLO Service
    → Python runs best.pt inference
    → Returns detected class labels + confidence scores
    → Node.js looks up labels in MySQL products table
    → Returns matched products to React Native
    → Products auto-populate bill-edit.tsx
```

---

## 3. Architecture Design

### Why a Separate Python Microservice?
Node.js cannot natively run `.pt` PyTorch/YOLO models. The cleanest approach is a **lightweight Python FastAPI microservice** that:
- Loads `best.pt` once at startup
- Exposes a `/detect` REST endpoint accepting an image
- Returns detected class names + confidence scores

Node.js calls this Python service internally (server-to-server), so the React Native app only ever talks to Node.js — **no frontend changes needed** beyond removing the mock.

### Architecture Diagram

```
[React Native App]
       │  POST /api/detect/products  (multipart image)
       ▼
[Node.js Express Backend]  :3000
       │  POST http://localhost:8000/detect  (image)
       ▼
[Python FastAPI YOLO Service]  :8000
       │  Runs best.pt inference
       │  Returns: [{ label: "Parle-G", confidence: 0.91 }, ...]
       ▼
[Node.js]  →  MySQL: SELECT * FROM products WHERE name LIKE '%Parle-G%'
       │  Returns matched products with price & product_id
       ▼
[React Native]  →  bill-edit.tsx populated with real detected items
```

---

## 4. Product Name Matching Strategy

The products table stores clean product names (e.g., `"Parle G Biscuit 100g"`).
The YOLO model returns class labels (e.g., `"Parle-G"`, `"maggi"`, `"lays_classic"`).

**Matching approach (in Node.js):**
1. **Exact match** — check if any product name exactly equals the YOLO label
2. **LIKE / contains match** — `WHERE LOWER(name) LIKE '%parle%'`
3. **Alias mapping** — a JSON config file (`yolo_label_map.json`) that maps YOLO class names → product name keywords (most reliable, gives you full control)

> ⭐ **Recommended**: Use `yolo_label_map.json` alias mapping. This is the most reliable method since YOLO class names may not perfectly match your DB product names.

---

## 5. Files to Create / Modify

### 5.1 🆕 Python YOLO Microservice (New Folder)

**Location:** `Project/yolo_service/`

```
yolo_service/
├── main.py              ← FastAPI app
├── requirements.txt     ← ultralytics, fastapi, uvicorn, pillow
└── best.pt              ← copy/symlink your fine-tuned model here
```

**`main.py` — core logic:**
```python
from fastapi import FastAPI, File, UploadFile
from ultralytics import YOLO
from PIL import Image
import io

app = FastAPI()
model = YOLO("best.pt")   # loaded once at startup

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    results = model(img)
    detections = []
    for r in results:
        for box in r.boxes:
            label = model.names[int(box.cls)]
            conf  = float(box.conf)
            if conf >= 0.40:           # confidence threshold
                detections.append({ "label": label, "confidence": conf })
    # deduplicate: keep highest confidence per label
    seen = {}
    for d in detections:
        if d["label"] not in seen or d["confidence"] > seen[d["label"]]:
            seen[d["label"]] = d["confidence"]
    return { "detections": [{"label": k, "confidence": v} for k, v in seen.items()] }
```

**`requirements.txt`:**
```
ultralytics>=8.0.0
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
pillow>=10.0.0
python-multipart>=0.0.9
```

**Start command:**
```bash
cd yolo_service
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

### 5.2 🆕 YOLO Label Map Config

**Location:** `backend/src/config/yoloLabelMap.json`

Maps YOLO class labels → search keywords for the DB. Edit this file to match your model's class names and your product names.

```json
{
  "Parle-G":       "parle",
  "maggi":         "maggi",
  "lays_classic":  "lays",
  "kurkure":       "kurkure",
  "britannia":     "britannia",
  "dairy_milk":    "dairy milk"
}
```

---

### 5.3 🔄 MODIFY `backend/src/routes/detectRoutes.js`

**Current:** Returns random products (mock).
**New:** Accepts an image upload → forwards to Python service → matches DB products.

```js
// backend/src/routes/detectRoutes.js (REPLACE ENTIRE FILE)
const express    = require('express');
const multer     = require('multer');
const fetch      = require('node-fetch');   // npm install node-fetch@2
const FormData   = require('form-data');
const authMiddleware = require('../middleware/authMiddleware');
const productService = require('../services/productService');
const labelMap   = require('../config/yoloLabelMap.json');
const pool       = require('../config/db');

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage() }); // keep image in RAM
router.use(authMiddleware);

const YOLO_SERVICE_URL = process.env.YOLO_SERVICE_URL || 'http://localhost:8000/detect';

// Helper: find product in DB by YOLO label
async function findProductByLabel(label, userId) {
  const keyword = (labelMap[label] || label).toLowerCase();
  const [rows] = await pool.query(
    `SELECT product_id, name, price FROM products
     WHERE user_id = ? AND LOWER(name) LIKE ?
     LIMIT 1`,
    [userId, `%${keyword}%`]
  );
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
      contentType: req.file.mimetype || 'image/jpeg'
    });

    const yoloRes  = await fetch(YOLO_SERVICE_URL, { method: 'POST', body: form });
    const yoloData = await yoloRes.json();
    const detections = yoloData.detections || [];   // [{ label, confidence }]

    // 2. Match each detection to a product in DB
    const userId  = req.user.user_id;
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
          yolo_label: det.label
        });
      }
    }

    // 3. Return matched products
    res.json({ detected: matched });

  } catch (err) {
    console.error('Detect products error:', err);
    // Graceful fallback: return empty list, app can handle
    res.status(500).json({ message: 'Detection service unavailable', detected: [] });
  }
});

module.exports = router;
```

---

### 5.4 🔄 MODIFY `backend/.env`

Add the Python service URL:
```env
YOLO_SERVICE_URL=http://localhost:8000/detect
```

---

### 5.5 🔄 MODIFY `app/camera.tsx` (Frontend)

**Current:** Calls `getMockDetectedProducts()` locally, then separately uploads the image.  
**New:** Upload the image to `/api/detect/products` (single call — image + detection together), then set results as pending bill items.

Key change in `confirmImage()`:

```ts
const confirmImage = useCallback(async () => {
  if (!capturedUri) return;
  setUploading(true);
  try {
    // Single call: upload image AND detect products
    const { detected, path } = await detectProductsFromImage(capturedUri);
    setPendingBillItems(detected);   // real YOLO results
    setPendingImagePath(path ?? null);
  } catch (e) {
    Alert.alert('Detection failed', 'Could not detect products. Please try again.');
    setUploading(false);
    return;
  }
  setUploading(false);
  router.replace('/bill-edit');
}, [capturedUri, setPendingBillItems, setPendingImagePath, router]);
```

---

### 5.6 🔄 MODIFY `backend/src/utils/api.ts` (or create helper)

Add a `detectProductsFromImage` function that:
1. Uploads the captured image as `multipart/form-data` to `POST /api/detect/products`
2. Returns `{ detected: BillItem[], path: string }`

```ts
export async function detectProductsFromImage(uri: string) {
  const token = await getToken();
  const form  = new FormData();
  form.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);

  const res  = await fetch(`${API_BASE}/api/detect/products`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
    body:    form
  });
  if (!res.ok) throw new Error('Detection request failed');
  const data = await res.json();
  return {
    detected: (data.detected || []).map((p: any) => ({
      productId: p.product_id,
      name:      p.name,
      price:     p.price,
      quantity:  p.quantity ?? 1
    })),
    path: data.image_path ?? null
  };
}
```

---

## 6. Database Consideration — `yolo_label` Column (Optional but Recommended)

To improve matching accuracy without relying on fuzzy text search, add a `yolo_label` column to the `products` table:

```sql
ALTER TABLE products ADD COLUMN yolo_label VARCHAR(100) NULL;
CREATE INDEX idx_products_yolo_label ON products(yolo_label);
```

Then in the product add/edit screen, the user can optionally type the YOLO class name for each product. Detection then uses:
```sql
SELECT * FROM products WHERE yolo_label = ? AND user_id = ?
```
This is the most accurate matching method long-term.

---

## 7. New Node.js Dependencies

Install in `backend/`:
```bash
npm install node-fetch@2 form-data
```

> `node-fetch@2` is used because it is CommonJS-compatible with Node.js without requiring ESM configuration.

---

## 8. Step-by-Step Implementation Order

1. **Create `yolo_service/` folder** — copy `best.pt` into it, create `main.py` and `requirements.txt`
2. **Install Python deps** → `pip install -r requirements.txt`
3. **Test YOLO service standalone** → `uvicorn main:app --port 8000` and POST a test image
4. **Add `yoloLabelMap.json`** in `backend/src/config/`
5. **Install Node.js deps** → `npm install node-fetch@2 form-data`
6. **Replace `detectRoutes.js`** with the real implementation
7. **Update `backend/.env`** with `YOLO_SERVICE_URL`
8. **Update `api.ts`** to add `detectProductsFromImage()`
9. **Update `camera.tsx`** to call `detectProductsFromImage()` instead of mock
10. **Populate `yolo_label` column** for each product in the DB (optional but recommended)
11. **End-to-end test**: take a photo → verify products auto-populate in bill-edit screen

---

## 9. Running the Full Stack

```bash
# Terminal 1 — Python YOLO Service
cd Project/yolo_service
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Node.js Backend
cd Project/backend
npm run dev

# Terminal 3 — React Native Expo Frontend
cd Project
npx expo start
```

---

## 10. Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Python service is down | Node.js returns `{ detected: [], message: "Detection service unavailable" }` — app shows empty bill, user can add manually |
| YOLO detects a product not in DB | Not added to bill; logged to console |
| Low confidence detection (< 0.40) | Filtered out by Python service |
| No products detected in image | Empty `detected[]` returned; `bill-edit.tsx` shows "No items" screen |
| Image upload fails | Existing error handling in `camera.tsx` catches and shows alert |

---

## 11. Confidence Threshold Tuning

The Python service uses `conf >= 0.40` by default. You can adjust this:
- **Too many false positives** → raise threshold to `0.55` or `0.65`
- **Missing real products** → lower threshold to `0.30`

Make it configurable via env var in `main.py`:
```python
import os
CONF_THRESHOLD = float(os.getenv("YOLO_CONF_THRESHOLD", "0.40"))
```

---

## 12. Summary of All Files Changed

| File | Action | Purpose |
|---|---|---|
| `yolo_service/main.py` | **CREATE** | Python FastAPI YOLO inference service |
| `yolo_service/requirements.txt` | **CREATE** | Python dependencies |
| `yolo_service/best.pt` | **COPY** | Your fine-tuned YOLO model |
| `backend/src/config/yoloLabelMap.json` | **CREATE** | Maps YOLO labels → DB search keywords |
| `backend/src/routes/detectRoutes.js` | **REPLACE** | Real AI detection instead of mock |
| `backend/.env` | **MODIFY** | Add `YOLO_SERVICE_URL` |
| `backend/src/utils/api.ts` | **MODIFY** | Add `detectProductsFromImage()` function |
| `app/camera.tsx` | **MODIFY** | Call real detect API, remove mock |
| `database/schema.sql` | **OPTIONAL MODIFY** | Add `yolo_label` column to products |
