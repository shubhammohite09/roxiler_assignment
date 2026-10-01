import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { pool } from './db.js';
import { check } from './validate.js';

const app = express();
app.use(cors());
app.use(express.json());
const SECRET = process.env.JWT_SECRET || 'dev-secret';
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const bad = (res, errors) => res.status(400).json({ errors });

const auth = (...roles) => (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    req.user = jwt.verify(token, SECRET);
  } catch { return res.status(401).json({ message: 'Not authenticated' }); }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
  next();
};

// Whitelisted sort columns prevent SQL injection
const order = (q, allowed, def) => `ORDER BY ${allowed[q.sort] || allowed[def]} ${q.order === 'desc' ? 'DESC' : 'ASC'}`;
const like = (params, v) => { params.push(`%${v}%`); return `$${params.length}`; };

app.post('/api/auth/signup', wrap(async (req, res) => {
  const errors = check(req.body, ['name', 'email', 'address', 'password']);
  if (Object.keys(errors).length) return bad(res, errors);
  const { name, email, address, password } = req.body;
  try {
    await pool.query('INSERT INTO users(name,email,password_hash,address,role) VALUES($1,$2,$3,$4,$5)',
      [name.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 10), address.trim(), 'user']);
  } catch (e) { if (e.code === '23505') return bad(res, { email: 'Email already registered' }); throw e; }
  res.status(201).json({ message: 'Registered' });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [String(req.body.email || '').toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash)))
    return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '8h' }),
             user: { id: u.id, name: u.name, role: u.role } });
}));

app.put('/api/auth/password', auth(), wrap(async (req, res) => {
  const errors = check({ password: req.body.newPassword }, ['password']);
  if (Object.keys(errors).length) return bad(res, { newPassword: errors.password });
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(req.body.currentPassword || '', rows[0].password_hash)))
    return bad(res, { currentPassword: 'Current password is incorrect' });
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(req.body.newPassword, 10), req.user.id]);
  res.json({ message: 'Password updated' });
}));

// ---- admin
app.get('/api/admin/stats', auth('admin'), wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT (SELECT count(*) FROM users)::int AS users, (SELECT count(*) FROM stores)::int AS stores,
            (SELECT count(*) FROM ratings)::int AS ratings`);
  res.json(rows[0]);
}));

app.post('/api/admin/users', auth('admin'), wrap(async (req, res) => {
  const errors = check(req.body, ['name', 'email', 'address', 'password']);
  if (!['admin', 'user', 'store_owner'].includes(req.body.role)) errors.role = 'Choose a role';
  if (Object.keys(errors).length) return bad(res, errors);
  const { name, email, address, password, role } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users(name,email,password_hash,address,role) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [name.trim(), email.trim().toLowerCase(), await bcrypt.hash(password, 10), address.trim(), role]);
    res.status(201).json(rows[0]);
  } catch (e) { if (e.code === '23505') return bad(res, { email: 'Email already registered' }); throw e; }
}));

app.post('/api/admin/stores', auth('admin'), wrap(async (req, res) => {
  const errors = check(req.body, ['storeName', 'email', 'address']);
  if (Object.keys(errors).length) return bad(res, errors);
  const { name, email, address, ownerId } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO stores(name,email,address,owner_id) VALUES($1,$2,$3,$4) RETURNING id',
      [name.trim(), email.trim().toLowerCase(), address.trim(), ownerId || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return bad(res, { email: 'Email or owner already used by another store' });
    if (e.code === '23503') return bad(res, { ownerId: 'Owner not found' });
    throw e;
  }
}));

const USER_SORT = { name: 'u.name', email: 'u.email', address: 'u.address', role: 'u.role' };
app.get('/api/admin/users', auth('admin'), wrap(async (req, res) => {
  const p = [], w = [];
  for (const f of ['name', 'email', 'address']) if (req.query[f]) w.push(`u.${f} ILIKE ${like(p, req.query[f])}`);
  if (req.query.role) { p.push(req.query.role); w.push(`u.role::text = $${p.length}`); }
  const { rows } = await pool.query(
    `SELECT u.id,u.name,u.email,u.address,u.role FROM users u ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
     ${order(req.query, USER_SORT, 'name')}`, p);
  res.json(rows);
}));

app.get('/api/admin/users/:id', auth('admin'), wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id,u.name,u.email,u.address,u.role,
       CASE WHEN u.role='store_owner' THEN
         (SELECT round(avg(r.rating),1) FROM ratings r JOIN stores s ON s.id=r.store_id WHERE s.owner_id=u.id) END AS rating
     FROM users u WHERE u.id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found' });
  res.json(rows[0]);
}));

const STORE_SORT = { name: 's.name', email: 's.email', address: 's.address', rating: 'rating' };
app.get('/api/admin/stores', auth('admin'), wrap(async (req, res) => {
  const p = [], w = [];
  for (const f of ['name', 'email', 'address']) if (req.query[f]) w.push(`s.${f} ILIKE ${like(p, req.query[f])}`);
  const { rows } = await pool.query(
    `SELECT s.id,s.name,s.email,s.address,
       (SELECT round(avg(rating),1) FROM ratings WHERE store_id=s.id) AS rating
     FROM stores s ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
     ${order(req.query, STORE_SORT, 'name')} NULLS LAST`, p);
  res.json(rows);
}));

// ---- normal user
app.get('/api/stores', auth('user'), wrap(async (req, res) => {
  const p = [req.user.id], w = [];
  if (req.query.search) { const t = like(p, req.query.search); w.push(`(s.name ILIKE ${t} OR s.address ILIKE ${t})`); }
  const sort = { name: 's.name', address: 's.address', rating: 'rating' };
  const { rows } = await pool.query(
    `SELECT s.id,s.name,s.address,
       (SELECT round(avg(rating),1) FROM ratings WHERE store_id=s.id) AS rating,
       (SELECT rating FROM ratings WHERE store_id=s.id AND user_id=$1) AS my_rating
     FROM stores s ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
     ${order(req.query, sort, 'name')} NULLS LAST`, p);
  res.json(rows);
}));

app.put('/api/stores/:id/rating', auth('user'), wrap(async (req, res) => {
  const r = Number(req.body.rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return bad(res, { rating: 'Rating must be 1 to 5' });
  try {
    await pool.query(
      `INSERT INTO ratings(user_id,store_id,rating) VALUES($1,$2,$3)
       ON CONFLICT (user_id,store_id) DO UPDATE SET rating=EXCLUDED.rating, updated_at=now()`,
      [req.user.id, req.params.id, r]);
  } catch (e) { if (e.code === '23503') return res.status(404).json({ message: 'Store not found' }); throw e; }
  res.json({ message: 'Rating saved' });
}));

// ---- store owner
app.get('/api/owner/dashboard', auth('store_owner'), wrap(async (req, res) => {
  const s = await pool.query('SELECT id,name FROM stores WHERE owner_id=$1', [req.user.id]);
  if (!s.rows[0]) return res.json({ store: null, average: null, raters: [] });
  const sort = { name: 'u.name', email: 'u.email', rating: 'r.rating', date: 'r.updated_at' };
  const raters = await pool.query(
    `SELECT u.name,u.email,r.rating,r.updated_at FROM ratings r JOIN users u ON u.id=r.user_id
     WHERE r.store_id=$1 ${order(req.query, sort, 'name')}`, [s.rows[0].id]);
  const avg = await pool.query('SELECT round(avg(rating),1) AS avg FROM ratings WHERE store_id=$1', [s.rows[0].id]);
  res.json({ store: s.rows[0], average: avg.rows[0].avg, raters: raters.rows });
}));

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: 'Server error' }); });
app.listen(process.env.PORT || 4000, () => console.log('API on :' + (process.env.PORT || 4000)));
