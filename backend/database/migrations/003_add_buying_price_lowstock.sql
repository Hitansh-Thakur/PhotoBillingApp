-- Migration: Add buying_price and low_stock_threshold columns to products
-- Also adds user_id to cashflow for proper user isolation

-- Add buying_price column (defaults to NULL; falls back to selling price in logic)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS buying_price DECIMAL(10, 2) NULL AFTER price;

-- Add low_stock_threshold column (default 5)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5 AFTER quantity;

-- Add user_id to cashflow for user isolation (if not already present)
ALTER TABLE cashflow
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER bill_id;

-- Add foreign-key index for cashflow.user_id (skip if already exists)
CREATE INDEX IF NOT EXISTS idx_cashflow_user ON cashflow(user_id);
