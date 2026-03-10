-- Migration: Add business_name column to users table
-- Run this migration to add support for storing business/store names

USE photo_billing;

ALTER TABLE users ADD COLUMN business_name VARCHAR(255) NULL AFTER name;

-- Verify the change
DESCRIBE users;
