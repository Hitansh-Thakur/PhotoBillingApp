const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

async function login(email, password) {
  const [rows] = await pool.query(
    'SELECT user_id, name, email, password FROM users WHERE email = ?',
    [email]
  );

  if (rows.length === 0) {
    return { success: false, message: 'Invalid email or password' };
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { success: false, message: 'Invalid email or password' };
  }

  const token = jwt.sign(
    { userId: user.user_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    success: true,
    token,
    user: { userId: user.user_id, name: user.name, email: user.email }
  };
}

async function register(name, email, password, businessName = null) {
  const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return { success: false, message: 'Email already registered' };
  }
  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    'INSERT INTO users (name, business_name, email, password) VALUES (?, ?, ?, ?)',
    [name, businessName, email, hashed]
  );
  const userId = result.insertId;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return {
    success: true,
    token,
    user: { userId, name, businessName, email }
  };
}

module.exports = { login, register };
