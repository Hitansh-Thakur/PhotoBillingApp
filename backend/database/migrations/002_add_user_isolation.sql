-- Migration: Add user_id for multi-store data isolation
-- This migration adds user_id columns to products and cashflow tables
-- to ensure each user can only access their own store's data

USE photo_billing;

-- Add user_id to products table
ALTER TABLE products 
  ADD COLUMN user_id INT NULL AFTER product_id,
  ADD CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- Add user_id to cashflow table
ALTER TABLE cashflow 
  ADD COLUMN user_id INT NULL AFTER entry_id,
  ADD CONSTRAINT fk_cashflow_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- Create indexes for efficient user-based queries
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_cashflow_user ON cashflow(user_id);

-- Optional: Update existing data to assign to first user (if needed)
-- Uncomment the following lines if you want to assign existing data to the first user
-- UPDATE products SET user_id = (SELECT user_id FROM users ORDER BY user_id LIMIT 1) WHERE user_id IS NULL;
-- UPDATE cashflow SET user_id = (SELECT user_id FROM users ORDER BY user_id LIMIT 1) WHERE user_id IS NULL;

-- Verify the changes
DESCRIBE products;
DESCRIBE cashflow;

-- Show the new constraints
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'photo_billing' 
  AND TABLE_NAME IN ('products', 'cashflow')
  AND REFERENCED_TABLE_NAME IS NOT NULL;
