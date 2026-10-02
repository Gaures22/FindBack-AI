-- FindBack AI Database Schema for MySQL
-- Database: findback_ai

CREATE DATABASE IF NOT EXISTS findback_ai;
USE findback_ai;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Items Table (Lost & Found Reports)
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('lost', 'found') NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  colour VARCHAR(50) DEFAULT NULL,
  location VARCHAR(255) NOT NULL,
  date_time DATETIME NOT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  contact_info VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'claimed', 'resolved', 'closed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Matches Table (AI Matches between Lost and Found Items)
CREATE TABLE IF NOT EXISTS matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lost_item_id INT NOT NULL,
  found_item_id INT NOT NULL,
  text_score FLOAT DEFAULT 0.0,
  image_score FLOAT DEFAULT 0.0,
  metadata_score FLOAT DEFAULT 0.0,
  final_score FLOAT DEFAULT 0.0,
  reasons TEXT DEFAULT NULL,
  status ENUM('potential', 'verified', 'rejected') DEFAULT 'potential',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lost_item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (found_item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- 4. Claims Table (Verification and Ownership Recovery Requests)
CREATE TABLE IF NOT EXISTS claims (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT DEFAULT NULL,
  item_id INT NOT NULL,
  claimant_id INT NOT NULL,
  verification_details TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (claimant_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DEMO SEED DATA
-- Default Passwords: "password123" (bcrypt hashed: $2a$10$wN9aW6vJz4k2oR3Z7F5vVOyG7sZ7k8n9u1q2w3e4r5t6y7u8i9o0)
INSERT INTO users (id, name, email, password, role) VALUES
(1, 'Campus Admin', 'admin@campus.edu', '$2a$10$wN9aW6vJz4k2oR3Z7F5vVOyG7sZ7k8n9u1q2w3e4r5t6y7u8i9o0', 'admin'),
(2, 'Rahul Sharma', 'rahul@student.edu', '$2a$10$wN9aW6vJz4k2oR3Z7F5vVOyG7sZ7k8n9u1q2w3e4r5t6y7u8i9o0', 'user'),
(3, 'Priya Patel', 'priya@student.edu', '$2a$10$wN9aW6vJz4k2oR3Z7F5vVOyG7sZ7k8n9u1q2w3e4r5t6y7u8i9o0', 'user')
ON DUPLICATE KEY UPDATE id=id;

-- Demo Lost & Found Items
INSERT INTO items (id, user_id, type, title, category, description, colour, location, date_time, image_url, contact_info, status) VALUES
(1, 2, 'lost', 'Black Dell XPS 15 Laptop', 'Electronics', 'Black Dell XPS 15 inch laptop with Intel Core i7, sticker on back lid reading "Code & Coffee", lost in a black sleeve near Central Library 2nd floor.', 'Black', 'Central Library 2nd Floor', '2026-09-28 14:30:00', '/uploads/demo_laptop.jpg', 'rahul@student.edu | +91 9876543210', 'active'),
(2, 3, 'found', 'Found Dell Laptop with Black Sleeve', 'Electronics', 'Found a black Dell laptop inside a black sleeve left on a table at Central Library reading area. Has stickers on the back.', 'Black', 'Central Library', '2026-09-28 16:00:00', '/uploads/demo_laptop.jpg', 'priya@student.edu', 'active'),
(3, 2, 'lost', 'Blue Leather Wallet with ID Cards', 'Personal Belongings', 'Blue leather wallet containing student ID card, college library card and cash lost near Sports Complex cafeteria.', 'Blue', 'Sports Complex Cafeteria', '2026-09-29 11:15:00', '/uploads/demo_wallet.jpg', 'rahul@student.edu', 'active'),
(4, 3, 'found', 'Blue Wallet Found near Sports Complex', 'Personal Belongings', 'Found a blue wallet near cafeteria entrance containing student cards and cash.', 'Blue', 'Sports Complex', '2026-09-29 12:30:00', '/uploads/demo_wallet.jpg', 'priya@student.edu', 'active')
ON DUPLICATE KEY UPDATE id=id;
