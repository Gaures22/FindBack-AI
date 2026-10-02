/**
 * FindBack AI - Node.js & Express API Backend
 * ----------------------------------------------------
 * Handles User Authentication, Item Reporting (Lost/Found),
 * Image Uploads, AI Match Orchestration (via Python AI Service),
 * Claims & Ownership Verification, and Admin Management.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'findback_ai_super_secret_key_2026';
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://127.0.0.1:5000/match';

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files and uploaded images
app.use(express.static(path.join(__dirname)));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: recursive = true });
}
app.use('/uploads', express.static(uploadsDir));

// Configure Multer for Image Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'item-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = file.mimetype.toLowerCase();
    if (allowed.test(ext) || allowed.test(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed.'));
    }
  }
});

// MySQL Database Connection Pool with Fallback
let dbPool = null;
let useMemoryFallback = false;

// In-Memory Storage Fallback (Guarantees zero-friction execution if MySQL server is not running)
const memoryDB = {
  users: [
    { id: 1, name: 'Campus Admin', email: 'admin@campus.edu', password: bcrypt.hashSync('password123', 10), role: 'admin', created_at: new Date() },
    { id: 2, name: 'Rahul Sharma', email: 'rahul@student.edu', password: bcrypt.hashSync('password123', 10), role: 'user', created_at: new Date() },
    { id: 3, name: 'Priya Patel', email: 'priya@student.edu', password: bcrypt.hashSync('password123', 10), role: 'user', created_at: new Date() }
  ],
  items: [
    {
      id: 1,
      user_id: 2,
      type: 'lost',
      title: 'Black Dell XPS 15 Laptop',
      category: 'Electronics',
      description: 'Black Dell XPS 15 inch laptop with Intel Core i7, sticker on back lid reading "Code & Coffee", lost in a black sleeve near Central Library 2nd floor.',
      colour: 'Black',
      location: 'Central Library 2nd Floor',
      date_time: '2026-09-28 14:30:00',
      image_url: '/uploads/demo_laptop.jpg',
      contact_info: 'rahul@student.edu | +91 9876543210',
      status: 'active',
      created_at: new Date()
    },
    {
      id: 2,
      user_id: 3,
      type: 'found',
      title: 'Found Dell Laptop with Black Sleeve',
      category: 'Electronics',
      description: 'Found a black Dell laptop inside a black sleeve left on a table at Central Library reading area. Has stickers on the back.',
      colour: 'Black',
      location: 'Central Library',
      date_time: '2026-09-28 16:00:00',
      image_url: '/uploads/demo_laptop.jpg',
      contact_info: 'priya@student.edu',
      status: 'active',
      created_at: new Date()
    },
    {
      id: 3,
      user_id: 2,
      type: 'lost',
      title: 'Blue Leather Wallet with ID Cards',
      category: 'Personal Belongings',
      description: 'Blue leather wallet containing student ID card, college library card and cash lost near Sports Complex cafeteria.',
      colour: 'Blue',
      location: 'Sports Complex Cafeteria',
      date_time: '2026-09-29 11:15:00',
      image_url: '/uploads/demo_wallet.jpg',
      contact_info: 'rahul@student.edu',
      status: 'active',
      created_at: new Date()
    },
    {
      id: 4,
      user_id: 3,
      type: 'found',
      title: 'Blue Wallet Found near Sports Complex',
      category: 'Personal Belongings',
      description: 'Found a blue wallet near cafeteria entrance containing student cards and cash.',
      colour: 'Blue',
      location: 'Sports Complex',
      date_time: '2026-09-29 12:30:00',
      image_url: '/uploads/demo_wallet.jpg',
      contact_info: 'priya@student.edu',
      status: 'active',
      created_at: new Date()
    }
  ],
  matches: [],
  claims: []
};

async function initializeDatabase() {
  try {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'findback_ai'
    };

    dbPool = mysql.createPool(config);
    // Test connection
    const connection = await dbPool.getConnection();
    console.log('✅ Connected to MySQL Database successfully.');
    connection.release();

    // Auto-create tables if missing
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbPool.query(`
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
    `);

    await dbPool.query(`
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
    `);

    await dbPool.query(`
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
    `);

    // Insert demo users if table is empty
    const [userRows] = await dbPool.query('SELECT COUNT(*) as count FROM users');
    if (userRows[0].count === 0) {
      console.log('🌱 Populating database with initial demo data...');
      const adminPass = await bcrypt.hash('password123', 10);
      const userPass = await bcrypt.hash('password123', 10);

      await dbPool.query(`
        INSERT INTO users (id, name, email, password, role) VALUES
        (1, 'Campus Admin', 'admin@campus.edu', ?, 'admin'),
        (2, 'Rahul Sharma', 'rahul@student.edu', ?, 'user'),
        (3, 'Priya Patel', 'priya@student.edu', ?, 'user');
      `, [adminPass, userPass, userPass]);

      await dbPool.query(`
        INSERT INTO items (id, user_id, type, title, category, description, colour, location, date_time, image_url, contact_info, status) VALUES
        (1, 2, 'lost', 'Black Dell XPS 15 Laptop', 'Electronics', 'Black Dell XPS 15 inch laptop with Intel Core i7, sticker on back lid reading "Code & Coffee", lost in a black sleeve near Central Library 2nd floor.', 'Black', 'Central Library 2nd Floor', '2026-09-28 14:30:00', '/uploads/demo_laptop.jpg', 'rahul@student.edu | +91 9876543210', 'active'),
        (2, 3, 'found', 'Found Dell Laptop with Black Sleeve', 'Electronics', 'Found a black Dell laptop inside a black sleeve left on a table at Central Library reading area. Has stickers on the back.', 'Black', 'Central Library', '2026-09-28 16:00:00', '/uploads/demo_laptop.jpg', 'priya@student.edu', 'active'),
        (3, 2, 'lost', 'Blue Leather Wallet with ID Cards', 'Personal Belongings', 'Blue leather wallet containing student ID card, college library card and cash lost near Sports Complex cafeteria.', 'Blue', 'Sports Complex Cafeteria', '2026-09-29 11:15:00', '/uploads/demo_wallet.jpg', 'rahul@student.edu', 'active'),
        (4, 3, 'found', 'Blue Wallet Found near Sports Complex', 'Personal Belongings', 'Found a blue wallet near cafeteria entrance containing student cards and cash.', 'Blue', 'Sports Complex', '2026-09-29 12:30:00', '/uploads/demo_wallet.jpg', 'priya@student.edu', 'active');
      `);
    }

  } catch (err) {
    console.warn('⚠️  MySQL connection notice:', err.message);
    console.log('💡 Switching to built-in in-memory database fallback for zero-friction testing.');
    useMemoryFallback = true;
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// Admin Authorization Middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privilege required.' });
  }
}

// ----------------------------------------------------
// AUTHENTICATION API ENDPOINTS
// ----------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    const userRole = role === 'admin' ? 'admin' : 'user';

    if (!useMemoryFallback && dbPool) {
      const [existing] = await dbPool.query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
      const [result] = await dbPool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPass, userRole]
      );
      const newUser = { id: result.insertId, name, email, role: userRole };
      const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ message: 'Registration successful', token, user: newUser });
    } else {
      const existing = memoryDB.users.find(u => u.email === email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
      const newUser = { id: memoryDB.users.length + 1, name, email, password: hashedPass, role: userRole, created_at: new Date() };
      memoryDB.users.push(newUser);
      const token = jwt.sign({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({ message: 'Registration successful', token, user: { id: newUser.id, name, email, role: userRole } });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    let user = null;
    if (!useMemoryFallback && dbPool) {
      const [rows] = await dbPool.query('SELECT * FROM users WHERE email = ?', [email]);
      user = rows[0];
    } else {
      user = memoryDB.users.find(u => u.email === email);
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token, user: userData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// ITEMS API ENDPOINTS (REPORT LOST / FOUND / BROWSE)
// ----------------------------------------------------

// Helper to format item date
function prepareItemPayload(body, file, userId) {
  return {
    user_id: userId,
    type: body.type, // 'lost' or 'found'
    title: body.title,
    category: body.category || 'Other',
    description: body.description,
    colour: body.colour || '',
    location: body.location,
    date_time: body.date_time || new Date().toISOString().slice(0, 19).replace('T', ' '),
    image_url: file ? `/uploads/${file.filename}` : (body.image_url || null),
    contact_info: body.contact_info || '',
    status: 'active'
  };
}

// POST /api/items/lost
app.post('/api/items/lost', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description, location } = req.body;
    if (!title || !description || !location) {
      return res.status(400).json({ error: 'Title, description, and location are required.' });
    }
    req.body.type = 'lost';
    const itemData = prepareItemPayload(req.body, req.file, req.user.id);

    let createdId = null;
    if (!useMemoryFallback && dbPool) {
      const [result] = await dbPool.query(
        `INSERT INTO items (user_id, type, title, category, description, colour, location, date_time, image_url, contact_info, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemData.user_id, itemData.type, itemData.title, itemData.category, itemData.description, itemData.colour, itemData.location, itemData.date_time, itemData.image_url, itemData.contact_info, itemData.status]
      );
      createdId = result.insertId;
    } else {
      createdId = memoryDB.items.length + 1;
      const newItem = { id: createdId, ...itemData, created_at: new Date() };
      memoryDB.items.push(newItem);
    }

    res.status(201).json({ message: 'Lost item reported successfully', item_id: createdId, item: { id: createdId, ...itemData } });
  } catch (err) {
    console.error('Report Lost error:', err);
    res.status(500).json({ error: 'Failed to submit lost item report.' });
  }
});

// POST /api/items/found
app.post('/api/items/found', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description, location } = req.body;
    if (!title || !description || !location) {
      return res.status(400).json({ error: 'Title, description, and location are required.' });
    }
    req.body.type = 'found';
    const itemData = prepareItemPayload(req.body, req.file, req.user.id);

    let createdId = null;
    if (!useMemoryFallback && dbPool) {
      const [result] = await dbPool.query(
        `INSERT INTO items (user_id, type, title, category, description, colour, location, date_time, image_url, contact_info, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemData.user_id, itemData.type, itemData.title, itemData.category, itemData.description, itemData.colour, itemData.location, itemData.date_time, itemData.image_url, itemData.contact_info, itemData.status]
      );
      createdId = result.insertId;
    } else {
      createdId = memoryDB.items.length + 1;
      const newItem = { id: createdId, ...itemData, created_at: new Date() };
      memoryDB.items.push(newItem);
    }

    res.status(201).json({ message: 'Found item reported successfully', item_id: createdId, item: { id: createdId, ...itemData } });
  } catch (err) {
    console.error('Report Found error:', err);
    res.status(500).json({ error: 'Failed to submit found item report.' });
  }
});

// GET /api/items (Search & Filter)
app.get('/api/items', async (req, res) => {
  try {
    const { type, category, colour, location, status, search } = req.query;

    if (!useMemoryFallback && dbPool) {
      let query = 'SELECT i.*, u.name as user_name FROM items i JOIN users u ON i.user_id = u.id WHERE 1=1';
      const params = [];

      if (type) { query += ' AND i.type = ?'; params.push(type); }
      if (category) { query += ' AND i.category = ?'; params.push(category); }
      if (colour) { query += ' AND i.colour LIKE ?'; params.push(`%${colour}%`); }
      if (location) { query += ' AND i.location LIKE ?'; params.push(`%${location}%`); }
      if (status) { query += ' AND i.status = ?'; params.push(status); }
      if (search) {
        query += ' AND (i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY i.created_at DESC';
      const [items] = await dbPool.query(query, params);
      return res.json({ items });
    } else {
      let filtered = [...memoryDB.items];
      if (type) filtered = filtered.filter(i => i.type === type);
      if (category) filtered = filtered.filter(i => i.category === category);
      if (colour) filtered = filtered.filter(i => i.colour && i.colour.toLowerCase().includes(colour.toLowerCase()));
      if (location) filtered = filtered.filter(i => i.location && i.location.toLowerCase().includes(location.toLowerCase()));
      if (status) filtered = filtered.filter(i => i.status === status);
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(i =>
          i.title.toLowerCase().includes(s) ||
          i.description.toLowerCase().includes(s) ||
          i.location.toLowerCase().includes(s)
        );
      }
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Attach user name
      const itemsWithUser = filtered.map(item => {
        const user = memoryDB.users.find(u => u.id === item.user_id);
        return { ...item, user_name: user ? user.name : 'Unknown User' };
      });

      return res.json({ items: itemsWithUser });
    }
  } catch (err) {
    console.error('Fetch items error:', err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// GET /api/items/search
app.get('/api/items/search', async (req, res) => {
  // Alias to GET /api/items
  req.url = '/api/items';
  app.handle(req, res);
});

// GET /api/items/:id
app.get('/api/items/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (!useMemoryFallback && dbPool) {
      const [rows] = await dbPool.query(
        'SELECT i.*, u.name as user_name, u.email as user_email FROM items i JOIN users u ON i.user_id = u.id WHERE i.id = ?',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
      return res.json({ item: rows[0] });
    } else {
      const item = memoryDB.items.find(i => i.id === id);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const user = memoryDB.users.find(u => u.id === item.user_id);
      return res.json({ item: { ...item, user_name: user ? user.name : 'Unknown', user_email: user ? user.email : '' } });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving item details.' });
  }
});

// PATCH /api/items/:id/status
app.patch('/api/items/:id/status', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const allowed = ['active', 'claimed', 'resolved', 'closed'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    if (!useMemoryFallback && dbPool) {
      await dbPool.query('UPDATE items SET status = ? WHERE id = ?', [status, id]);
    } else {
      const item = memoryDB.items.find(i => i.id === id);
      if (item) item.status = status;
    }

    res.json({ message: `Item status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item status.' });
  }
});

// ----------------------------------------------------
// AI MATCHING API ENDPOINTS
// ----------------------------------------------------

// Node.js fallback AI scoring algorithm (used if Python AI microservice is offline)
function fallbackMatchScore(targetItem, candidateItem) {
  // Text matching
  const t1 = (targetItem.title + ' ' + targetItem.description).toLowerCase();
  const t2 = (candidateItem.title + ' ' + candidateItem.description).toLowerCase();
  const words1 = new Set(t1.replace(/[^a-z0-9\s]/g, '').split(/\s+/));
  const words2 = new Set(t2.replace(/[^a-z0-9\s]/g, '').split(/\s+/));

  let common = 0;
  words1.forEach(w => { if (w.length > 2 && words2.has(w)) common++; });
  const textScore = words1.size > 0 ? common / Math.max(words1.size, 1) : 0;

  // Metadata matching
  let catScore = targetItem.category.toLowerCase() === candidateItem.category.toLowerCase() ? 1.0 : 0.0;
  let colScore = 0.5;
  if (targetItem.colour && candidateItem.colour) {
    colScore = targetItem.colour.toLowerCase() === candidateItem.colour.toLowerCase() ? 1.0 : 0.0;
  }
  let locScore = targetItem.location.toLowerCase().includes(candidateItem.location.toLowerCase()) ||
                 candidateItem.location.toLowerCase().includes(targetItem.location.toLowerCase()) ? 0.8 : 0.2;

  const metadataScore = (catScore * 0.4) + (colScore * 0.3) + (locScore * 0.3);
  const imageScore = 0.5; // neutral fallback

  const finalScore = (textScore * 0.4) + (imageScore * 0.3) + (metadataScore * 0.3);

  const reasons = [];
  if (catScore === 1.0) reasons.push(`Category match: ${targetItem.category}`);
  if (colScore === 1.0) reasons.push(`Colour match: ${targetItem.colour}`);
  if (locScore >= 0.8) reasons.push(`Location proximity match`);
  if (textScore >= 0.3) reasons.push(`Keyword similarity (${Math.round(textScore * 100)}%)`);

  return {
    candidate_id: candidateItem.id,
    text_score: Number(textScore.toFixed(2)),
    image_score: Number(imageScore.toFixed(2)),
    metadata_score: Number(metadataScore.toFixed(2)),
    final_score: Number(finalScore.toFixed(2)),
    is_potential_match: finalScore >= 0.35,
    reasons
  };
}

// POST /api/matches (Triggers AI Match Engine)
app.post('/api/matches', async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'itemId is required' });

    let targetItem = null;
    let candidates = [];

    if (!useMemoryFallback && dbPool) {
      const [tRows] = await dbPool.query('SELECT * FROM items WHERE id = ?', [itemId]);
      if (tRows.length === 0) return res.status(404).json({ error: 'Item not found' });
      targetItem = tRows[0];

      const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';
      const [cRows] = await dbPool.query('SELECT * FROM items WHERE type = ? AND status != "closed"', [oppositeType]);
      candidates = cRows;
    } else {
      targetItem = memoryDB.items.find(i => i.id === parseInt(itemId));
      if (!targetItem) return res.status(404).json({ error: 'Item not found' });

      const oppositeType = targetItem.type === 'lost' ? 'found' : 'lost';
      candidates = memoryDB.items.filter(i => i.type === oppositeType && i.status !== 'closed');
    }

    if (candidates.length === 0) {
      return res.json({ message: 'No candidate items to match against.', matches: [] });
    }

    // Call Python AI Service
    let matchResults = [];
    try {
      const payload = JSON.stringify({ target_item: targetItem, candidate_items: candidates });
      const pythonResponse = await new Promise((resolve, reject) => {
        const url = new URL(PYTHON_AI_URL);
        const options = {
          hostname: url.hostname,
          port: url.port || 5000,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 4000
        };

        const req = http.request(options, (pyRes) => {
          let body = '';
          pyRes.on('data', chunk => body += chunk);
          pyRes.on('end', () => {
            if (pyRes.statusCode === 200) {
              try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            } else {
              reject(new Error(`Python service status ${pyRes.statusCode}`));
            }
          });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => { req.destroy(); reject(new Error('Python AI service timeout')); });
        req.write(payload);
        req.end();
      });

      if (pythonResponse && pythonResponse.matches) {
        matchResults = pythonResponse.matches;
      }
    } catch (aiErr) {
      console.warn('ℹ️ Python AI Service offline or timing out. Using Node.js internal AI matching fallback.');
      matchResults = candidates.map(c => fallbackMatchScore(targetItem, c));
      matchResults.sort((a, b) => b.final_score - a.final_score);
    }

    // Store potential matches in Database / Memory
    for (const match of matchResults) {
      if (match.is_potential_match) {
        const lostId = targetItem.type === 'lost' ? targetItem.id : match.candidate_id;
        const foundId = targetItem.type === 'found' ? targetItem.id : match.candidate_id;
        const reasonsStr = JSON.stringify(match.reasons);

        if (!useMemoryFallback && dbPool) {
          await dbPool.query(`
            INSERT INTO matches (lost_item_id, found_item_id, text_score, image_score, metadata_score, final_score, reasons, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'potential')
            ON DUPLICATE KEY UPDATE
            text_score = VALUES(text_score), image_score = VALUES(image_score), metadata_score = VALUES(metadata_score), final_score = VALUES(final_score), reasons = VALUES(reasons)
          `, [lostId, foundId, match.text_score, match.image_score, match.metadata_score, match.final_score, reasonsStr]);
        } else {
          const existingIdx = memoryDB.matches.findIndex(m => m.lost_item_id === lostId && m.found_item_id === foundId);
          const matchRecord = {
            id: existingIdx >= 0 ? memoryDB.matches[existingIdx].id : memoryDB.matches.length + 1,
            lost_item_id: lostId,
            found_item_id: foundId,
            text_score: match.text_score,
            image_score: match.image_score,
            metadata_score: match.metadata_score,
            final_score: match.final_score,
            reasons: reasonsStr,
            status: 'potential',
            created_at: new Date()
          };
          if (existingIdx >= 0) {
            memoryDB.matches[existingIdx] = matchRecord;
          } else {
            memoryDB.matches.push(matchRecord);
          }
        }
      }
    }

    res.json({
      message: 'AI Matching completed successfully',
      target_item: targetItem,
      total_matches: matchResults.length,
      matches: matchResults
    });

  } catch (err) {
    console.error('Match engine error:', err);
    res.status(500).json({ error: 'Failed to process AI matching.' });
  }
});

// GET /api/matches/:itemId
app.get('/api/matches/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);

    if (!useMemoryFallback && dbPool) {
      const [matches] = await dbPool.query(`
        SELECT m.*,
               l.title as lost_title, l.category as lost_category, l.location as lost_location, l.image_url as lost_image,
               f.title as found_title, f.category as found_category, f.location as found_location, f.image_url as found_image, f.contact_info as found_contact
        FROM matches m
        JOIN items l ON m.lost_item_id = l.id
        JOIN items f ON m.found_item_id = f.id
        WHERE m.lost_item_id = ? OR m.found_item_id = ?
        ORDER BY m.final_score DESC
      `, [itemId, itemId]);

      const formatted = matches.map(m => ({
        ...m,
        reasons: m.reasons ? JSON.parse(m.reasons) : []
      }));
      return res.json({ matches: formatted });
    } else {
      const itemMatches = memoryDB.matches.filter(m => m.lost_item_id === itemId || m.found_item_id === itemId);
      const formatted = itemMatches.map(m => {
        const lost = memoryDB.items.find(i => i.id === m.lost_item_id) || {};
        const found = memoryDB.items.find(i => i.id === m.found_item_id) || {};
        return {
          ...m,
          lost_title: lost.title, lost_category: lost.category, lost_location: lost.location, lost_image: lost.image_url,
          found_title: found.title, found_category: found.category, found_location: found.location, found_image: found.image_url, found_contact: found.contact_info,
          reasons: typeof m.reasons === 'string' ? JSON.parse(m.reasons) : (m.reasons || [])
        };
      });
      formatted.sort((a, b) => b.final_score - a.final_score);
      return res.json({ matches: formatted });
    }
  } catch (err) {
    res.status(500).json({ error: 'Error loading item matches.' });
  }
});

// ----------------------------------------------------
// CLAIMS & VERIFICATION API ENDPOINTS
// ----------------------------------------------------

// POST /api/claims (Submit Claim / Verification details)
app.post('/api/claims', authenticateToken, async (req, res) => {
  try {
    const { item_id, match_id, verification_details } = req.body;
    if (!item_id || !verification_details) {
      return res.status(400).json({ error: 'Item ID and verification details are required.' });
    }

    let claimId = null;
    if (!useMemoryFallback && dbPool) {
      const [result] = await dbPool.query(
        'INSERT INTO claims (match_id, item_id, claimant_id, verification_details, status) VALUES (?, ?, ?, ?, "pending")',
        [match_id || null, item_id, req.user.id, verification_details]
      );
      claimId = result.insertId;
      await dbPool.query('UPDATE items SET status = "claimed" WHERE id = ?', [item_id]);
    } else {
      claimId = memoryDB.claims.length + 1;
      const newClaim = {
        id: claimId,
        match_id: match_id || null,
        item_id: parseInt(item_id),
        claimant_id: req.user.id,
        verification_details,
        status: 'pending',
        created_at: new Date()
      };
      memoryDB.claims.push(newClaim);
      const item = memoryDB.items.find(i => i.id === parseInt(item_id));
      if (item) item.status = 'claimed';
    }

    res.status(201).json({ message: 'Claim verification submitted successfully.', claim_id: claimId });
  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Failed to submit claim.' });
  }
});

// GET /api/claims (User or Admin Claims List)
app.get('/api/claims', authenticateToken, async (req, res) => {
  try {
    if (!useMemoryFallback && dbPool) {
      let query = `
        SELECT c.*, i.title as item_title, i.category as item_category, i.type as item_type, u.name as claimant_name, u.email as claimant_email
        FROM claims c
        JOIN items i ON c.item_id = i.id
        JOIN users u ON c.claimant_id = u.id
      `;
      const params = [];
      if (req.user.role !== 'admin') {
        query += ' WHERE c.claimant_id = ? OR i.user_id = ?';
        params.push(req.user.id, req.user.id);
      }
      query += ' ORDER BY c.created_at DESC';
      const [claims] = await dbPool.query(query, params);
      return res.json({ claims });
    } else {
      let claimsList = [...memoryDB.claims];
      if (req.user.role !== 'admin') {
        claimsList = claimsList.filter(c => {
          const item = memoryDB.items.find(i => i.id === c.item_id);
          return c.claimant_id === req.user.id || (item && item.user_id === req.user.id);
        });
      }
      const formatted = claimsList.map(c => {
        const item = memoryDB.items.find(i => i.id === c.item_id) || {};
        const claimant = memoryDB.users.find(u => u.id === c.claimant_id) || {};
        return {
          ...c,
          item_title: item.title,
          item_category: item.category,
          item_type: item.type,
          claimant_name: claimant.name,
          claimant_email: claimant.email
        };
      });
      return res.json({ claims: formatted });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch claims.' });
  }
});

// PATCH /api/claims/:id/status (Approve or Reject Claim)
app.patch('/api/claims/:id/status', authenticateToken, async (req, res) => {
  try {
    const claimId = parseInt(req.params.id);
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    if (!useMemoryFallback && dbPool) {
      const [cRows] = await dbPool.query('SELECT item_id FROM claims WHERE id = ?', [claimId]);
      if (cRows.length === 0) return res.status(404).json({ error: 'Claim not found' });
      const itemId = cRows[0].item_id;

      await dbPool.query('UPDATE claims SET status = ? WHERE id = ?', [status, claimId]);
      if (status === 'approved') {
        await dbPool.query('UPDATE items SET status = "resolved" WHERE id = ?', [itemId]);
      } else {
        await dbPool.query('UPDATE items SET status = "active" WHERE id = ?', [itemId]);
      }
    } else {
      const claim = memoryDB.claims.find(c => c.id === claimId);
      if (!claim) return res.status(404).json({ error: 'Claim not found' });
      claim.status = status;

      const item = memoryDB.items.find(i => i.id === claim.item_id);
      if (item) {
        item.status = status === 'approved' ? 'resolved' : 'active';
      }
    }

    res.json({ message: `Claim status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update claim.' });
  }
});

// ----------------------------------------------------
// ADMIN MANAGEMENT API ENDPOINTS
// ----------------------------------------------------

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!useMemoryFallback && dbPool) {
      const [uCount] = await dbPool.query('SELECT COUNT(*) as count FROM users');
      const [iCount] = await dbPool.query('SELECT COUNT(*) as count FROM items');
      const [lCount] = await dbPool.query('SELECT COUNT(*) as count FROM items WHERE type = "lost"');
      const [fCount] = await dbPool.query('SELECT COUNT(*) as count FROM items WHERE type = "found"');
      const [cCount] = await dbPool.query('SELECT COUNT(*) as count FROM claims WHERE status = "pending"');
      const [rCount] = await dbPool.query('SELECT COUNT(*) as count FROM items WHERE status = "resolved"');

      res.json({
        users: uCount[0].count,
        total_items: iCount[0].count,
        lost_items: lCount[0].count,
        found_items: fCount[0].count,
        pending_claims: cCount[0].count,
        resolved_items: rCount[0].count
      });
    } else {
      res.json({
        users: memoryDB.users.length,
        total_items: memoryDB.items.length,
        lost_items: memoryDB.items.filter(i => i.type === 'lost').length,
        found_items: memoryDB.items.filter(i => i.type === 'found').length,
        pending_claims: memoryDB.claims.filter(c => c.status === 'pending').length,
        resolved_items: memoryDB.items.filter(i => i.status === 'resolved').length
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to load admin stats.' });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!useMemoryFallback && dbPool) {
      const [users] = await dbPool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
      res.json({ users });
    } else {
      const users = memoryDB.users.map(({ password, ...rest }) => rest);
      res.json({ users });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// Start Server & Initialize Database
app.listen(PORT, async () => {
  console.log(`🌐 FindBack AI Node backend running at http://localhost:${PORT}`);
  await initializeDatabase();
});
