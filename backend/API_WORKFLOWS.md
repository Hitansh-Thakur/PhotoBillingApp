# Photo Billing Backend - API Workflows

This document describes the complete API workflows for the photo billing application, including all endpoints, request/response formats, and transaction flows.

## 🔐 Security Features

- **JWT Authentication**: All protected endpoints require `Authorization: Bearer <token>` header
- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **Image Upload**: Multer middleware with file type validation (jpeg, jpg, png, webp only)
- **SQL Transactions**: Atomic operations with automatic rollback on failure
- **Input Validation**: express-validator for all request parameters

---

## 📸 Workflow 1: Photo-Based Billing (Home Tab)

### Frontend Flow
1. Capture Image
2. Preview
3. Confirm
4. Send Bill Data to Backend

### API Endpoints

#### Upload Bill Image
```http
POST /api/upload/image
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
  image: <file>

Response 200:
{
  "path": "/uploads/bill_1234567890_abc123.jpg",
  "filename": "bill_1234567890_abc123.jpg"
}
```

#### Create Bill (Separate Upload)
```http
POST /api/bills
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "product_id": 2, "quantity": 2, "price": 100 },
    { "product_id": 5, "quantity": 1, "price": 220.5 }
  ],
  "imagePath": "/uploads/bill_1234567890_abc123.jpg"
}

Response 201:
{
  "bill_id": 123,
  "total_amount": 420.50,
  "items": [...],
  "date": "2026-02-12"
}
```

#### Combined Upload + Create Bill
```http
POST /api/bills/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
  image: <file>
  items: '[{"product_id":2,"quantity":2,"price":100},{"product_id":5,"quantity":1,"price":220.5}]'

Response 201:
{
  "bill_id": 123,
  "total_amount": 420.50,
  "items": [...],
  "date": "2026-02-12"
}
```

#### Get Bill Items
```http
GET /api/bills/:billId/items
Authorization: Bearer <token>

Response 200:
[
  {
    "bill_item_id": 1,
    "product_id": 2,
    "name": "Product Name",
    "quantity": 2,
    "price": 100
  }
]
```

### Transaction Flow
```
START TRANSACTION
  ↓
1. Insert into bills (user_id, total_amount, image_path)
  ↓
2. For each item:
   - Validate product exists
   - Check sufficient quantity
   - Insert into bill_items
   - UPDATE products SET quantity = quantity - ?
  ↓
3. Insert into cashflow (type='income', amount, bill_id)
  ↓
COMMIT (or ROLLBACK on any error)
```

---

## 📦 Workflow 2: Inventory (Inventory Tab)

### API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Get inventory | `GET` | `/api/products` |
| Add product | `POST` | `/api/products` |
| Update price | `PUT` | `/api/products/:id` |
| Update quantity | `PUT` | `/api/products/:id/stock` |
| Delete product | `DELETE` | `/api/products/:id` |

#### Get All Products
```http
GET /api/products
Authorization: Bearer <token>

Response 200:
[
  {
    "product_id": 1,
    "name": "Product Name",
    "price": 100.00,
    "quantity": 50
  }
]
```

#### Add Product
```http
POST /api/products
Authorization: Bearer <token>

{
  "name": "New Product",
  "price": 150.00,
  "quantity": 20
}

Response 201:
{
  "product_id": 10,
  "name": "New Product",
  "price": 150.00,
  "quantity": 20
}
```

#### Update Product Stock
```http
PUT /api/products/:id/stock
Authorization: Bearer <token>

{
  "quantity": 75
}

Response 200:
{
  "product_id": 1,
  "name": "Product Name",
  "price": 100.00,
  "quantity": 75
}
```

---

## 💰 Workflow 3: Cashflow (Cashflow Tab)

### API Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Get all entries | `GET` | `/api/cashflow` |
| Get summary | `GET` | `/api/cashflow/summary` |
| Add expense | `POST` | `/api/cashflow/expense` |
| Add entry (generic) | `POST` | `/api/cashflow` |

#### Get Cashflow Summary
```http
GET /api/cashflow/summary?startDate=2026-01-01&endDate=2026-02-12
Authorization: Bearer <token>

Response 200:
{
  "totalIncome": 5000.00,
  "totalExpenses": 1200.00,
  "balance": 3800.00,
  "period": {
    "startDate": "2026-01-01",
    "endDate": "2026-02-12"
  }
}
```

#### Get All Cashflow Entries
```http
GET /api/cashflow
Authorization: Bearer <token>

Response 200:
{
  "summary": {
    "totalIncome": 5000.00,
    "totalExpenses": 1200.00,
    "balance": 3800.00,
    "period": null
  },
  "entries": [
    {
      "entry_id": 1,
      "type": "income",
      "amount": 420.50,
      "date": "2026-02-12",
      "description": null,
      "bill_id": 123
    }
  ]
}
```

#### Add Expense
```http
POST /api/cashflow/expense
Authorization: Bearer <token>

{
  "amount": 150.00,
  "description": "Office supplies",
  "date": "2026-02-12"
}

Response 201:
{
  "entry_id": 45,
  "type": "expense",
  "amount": 150.00,
  "date": "2026-02-12",
  "description": "Office supplies"
}
```

---

## 📊 Workflow 4: Account & Analytics (Account Tab)

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}

Response 201:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Login
```http
POST /api/auth/login

{
  "email": "john@example.com",
  "password": "securepass123"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### Get User Profile
```http
GET /api/users/me
Authorization: Bearer <token>

Response 200:
{
  "user_id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2026-01-15T10:30:00.000Z"
}
```

### Analytics Endpoints

| Action | Method | Endpoint |
|--------|--------|----------|
| Total revenue | `GET` | `/api/analytics/revenue` |
| Best selling | `GET` | `/api/analytics/top-products` |
| Daily sales | `GET` | `/api/analytics/daily` |
| Full analytics | `GET` | `/api/analytics` |

#### Get Total Revenue
```http
GET /api/analytics/revenue?days=30
Authorization: Bearer <token>

Response 200:
{
  "totalRevenue": 15000.00,
  "period": "30 days"
}
```

#### Get Top Products
```http
GET /api/analytics/top-products?limit=10&days=30
Authorization: Bearer <token>

Response 200:
[
  {
    "product_id": 5,
    "name": "Best Seller",
    "total_sold": 150,
    "revenue": 7500.00
  }
]
```

#### Get Daily Sales
```http
GET /api/analytics/daily
Authorization: Bearer <token>

Response 200:
[
  {
    "period": "2026-02-12",
    "total": 1250.00
  },
  {
    "period": "2026-02-11",
    "total": 980.50
  }
]
```

#### Get Complete Analytics
```http
GET /api/analytics
Authorization: Bearer <token>

Response 200:
{
  "bestSellingProducts": [...],
  "dailySales": [...],
  "monthlySales": [...],
  "inventoryValue": {
    "totalValue": 25000.00,
    "productCount": 45
  },
  "profitLoss": {
    "totalIncome": 15000.00,
    "totalExpense": 3000.00,
    "profit": 12000.00,
    "period": "30 days"
  }
}
```

---

## 🗄️ Database Tables Mapping

| API Endpoint | Tables Used |
|--------------|-------------|
| `/api/products` | `products` |
| `/api/bills` | `bills`, `bill_items`, `products`, `cashflow` |
| `/api/cashflow` | `cashflow` |
| `/api/users` | `users` |
| `/api/analytics` | `bills`, `bill_items`, `products`, `cashflow` |

---

## ⚠️ Error Handling

All endpoints return consistent error responses:

```json
{
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation errors, insufficient stock)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔄 Transaction Rollback Example

If any step in bill creation fails, the entire transaction is rolled back:

```javascript
// Example: Creating bill with insufficient stock
POST /api/bills
{
  "items": [
    { "product_id": 1, "quantity": 100 }  // Only 50 in stock
  ]
}

// Response 400:
{
  "message": "Insufficient quantity for Product Name"
}

// Result: No data is saved to any table
// - No bill record created
// - No bill_items created
// - No inventory reduced
// - No cashflow entry created
```

---

## 🚀 Getting Started

1. **Set up environment variables** (`.env`):
   ```
   PORT=4000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=photo_billing
   JWT_SECRET=your-secret-key
   JWT_EXPIRES=7d
   ```

2. **Initialize database**:
   ```bash
   mysql -u root -p < database/schema.sql
   ```

3. **Start server**:
   ```bash
   npm run dev
   ```

4. **Test endpoints** using Postman, Thunder Client, or curl
