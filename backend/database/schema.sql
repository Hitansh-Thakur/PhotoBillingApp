-- Photo Billing Backend - Database Schema
-- Run this to create the database and tables

CREATE DATABASE IF NOT EXISTS photo_billing;
USE photo_billing;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(10, 2) NOT NULL,
  image_path VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Bill items (line items for each bill)
CREATE TABLE IF NOT EXISTS bill_items (
  bill_item_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
);

-- Cashflow entries (income from bills, expenses)
CREATE TABLE IF NOT EXISTS cashflow (
  entry_id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  description VARCHAR(500) NULL,
  bill_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_bills_date ON bills(date);
CREATE INDEX idx_bills_user ON bills(user_id);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_cashflow_date ON cashflow(date);
CREATE INDEX idx_cashflow_type ON cashflow(type);
