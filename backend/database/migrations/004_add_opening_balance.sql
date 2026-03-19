-- Migration 004: Add opening_balance to users table
-- This persists the user's opening balance in the database
-- so profile updates (including opening balance) survive across sessions.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER business_name;
