import bcrypt from 'bcryptjs';
import { pool } from './db.js';
const hash = await bcrypt.hash('Admin@1234', 10);
await pool.query(
  `INSERT INTO users(name,email,password_hash,address,role) VALUES($1,$2,$3,$4,'admin') ON CONFLICT (email) DO NOTHING`,
  ['System Administrator Account', 'admin@example.com', hash, 'HQ']);
console.log('Seeded admin@example.com / Admin@1234');
await pool.end();
