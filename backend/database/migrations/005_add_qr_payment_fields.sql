-- Add Razorpay payment fields to bills table
ALTER TABLE bills
ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN razorpay_order_id VARCHAR(100) NULL,
ADD COLUMN paid_at DATETIME NULL;

-- Index for faster webhook lookups
CREATE INDEX idx_bills_order_id ON bills(razorpay_order_id);
