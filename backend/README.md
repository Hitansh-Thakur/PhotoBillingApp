# Photo Billing Backend

Node.js + Express + MySQL backend for photo-based billing, inventory, cashflow, and analytics.

## Setup

1. **Install dependencies**
   ```bash
   cd backend && npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials and JWT secret
   ```

3. **Create database**
   ```bash
   mysql -u root -p < database/schema.sql
   ```

4. **Seed demo data (optional)**
   ```bash
   node database/seed.js
   # Demo user: demo@example.com / demo123
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   API runs at `http://localhost:4000`

## API Endpoints

### Auth (no JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT |

### Products (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | Get product |
| POST | `/api/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |

### Photo-Based Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/image` | Upload image, returns path |
| POST | `/api/detect/products` | Mock: detect products from inventory |
| POST | `/api/bills` | Create bill (reduces inventory, records cashflow) |
| GET | `/api/bills` | List bills |

### Cashflow
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cashflow` | Summary + entries |
| POST | `/api/cashflow/expense` | Add expense |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Best selling, sales, inventory value, P&L |

## Request Headers

For protected routes, include:
```
Authorization: Bearer <jwt_token>
```

## Bill Creation Payload

```json
{
  "items": [
    { "product_id": 1, "quantity": 2, "price": 45 },
    { "product_id": 2, "quantity": 1 }
  ],
  "imagePath": "/uploads/bill_123.jpg"
}
```
`price` is optional; uses product price if omitted.
