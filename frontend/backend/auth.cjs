const express = require('express');
const { randomBytes } = require('node:crypto');
const { hashPassword, verifyPassword, PREFIX } = require('./passwords.cjs');
const USER_SQL = `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.id_rol,
  u.activo, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol`;
const COOKIE = 'sigi_session';
const DURATION = 8 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, sameSite: 'strict', path: '/', secure: process.env.NODE_ENV === 'production' };
const cleanEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const validEmail = email => email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const tokenFrom = req => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
const publicUser = row => ({ id_usuario: row.id_usuario, nombre: row.nombre, apellido: row.apellido, correo: row.correo, id_rol: row.id_rol, rol: row.rol });

function createAuth(pool) {
  const router = express.Router();
  const sessions = new Map();
  const attempts = new Map();
  const cleanup = setInterval(() => {
    for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
    for (const [key, attempt] of attempts) if (attempt.expires <= Date.now()) attempts.delete(key);
  }, 60000);
  cleanup.unref();

  function newSession(req, res, id) {
    sessions.delete(tokenFrom(req));
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { id, expires: Date.now() + DURATION });
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: DURATION });
  }

  async function requireAuth(req, res, next) {
    const token = tokenFrom(req);
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now()) {
      sessions.delete(token);
      return res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
    }
    try {
      const [rows] = await pool.execute(`${USER_SQL} WHERE u.id_usuario = ? AND u.activo = 1`, [session.id]);
      if (!rows.length) {
        sessions.delete(token);
        return res.status(401).json({ mensaje: 'La cuenta no está disponible.' });
      }
      req.usuario = publicUser(rows[0]);
      next();
    } catch (error) { next(error); }
  }

  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (req.method === 'POST') {
      // JSON plus a custom header prevents cross-origin HTML forms from changing a session.
      if (!req.is('application/json') || req.get('X-SIGI-Request') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site') {
        return res.status(403).json({ mensaje: 'Solicitud no permitida.' });
      }
      if (req.path === '/login' || req.path === '/registro') {
        const key = req.ip;
        let attempt = attempts.get(key);
        if (!attempt || attempt.expires <= Date.now()) {
          attempt = { count: 0, expires: Date.now() + 15 * 60 * 1000 };
          attempts.set(key, attempt);
        }
        if (++attempt.count > 30) return res.status(429).json({ mensaje: 'Demasiados intentos. Intenta nuevamente en 15 minutos.' });
      }
    }
    next();
  });

  router.post('/registro', async (req, res, next) => {
    const { nombre, apellido, password } = req.body || {};
    const correo = cleanEmail(req.body?.correo);
    if (![nombre, apellido].every(v => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100)
      || !validEmail(correo) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ mensaje: 'Completa nombre, apellido, correo válido y contraseña de 8 a 128 caracteres.' });
    }
    let connection;
    try {
      const hash = await hashPassword(password);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [authorized] = await connection.execute('SELECT id_rol FROM correos_autorizados WHERE correo = ? AND activo = 1 FOR UPDATE', [correo]);
      if (!authorized.length) {
        await connection.rollback();
        return res.status(403).json({ mensaje: 'Tu correo no está autorizado para registrarse. Solicita autorización al administrador.' });
      }
      const [result] = await connection.execute(
        'INSERT INTO usuarios (nombre, apellido, correo, password, id_rol) VALUES (?, ?, ?, ?, ?)',
        [nombre.trim(), apellido.trim(), correo, hash, authorized[0].id_rol]
      );
      const [rows] = await connection.execute(`${USER_SQL} WHERE u.id_usuario = ?`, [result.insertId]);
      await connection.commit();
      newSession(req, res, result.insertId);
      res.status(201).json({ usuario: publicUser(rows[0]) });
    } catch (error) {
      if (connection) await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ mensaje: 'Este correo ya tiene una cuenta. Inicia sesión.' });
      next(error);
    } finally { connection?.release(); }
  });

  router.post('/login', async (req, res, next) => {
    const correo = cleanEmail(req.body?.correo);
    const password = req.body?.password;
    if (!validEmail(correo) || typeof password !== 'string' || password.length === 0 || password.length > 128) {
      return res.status(400).json({ mensaje: 'Ingresa un correo y contraseña válidos.' });
    }
    try {
      const [rows] = await pool.execute('SELECT id_usuario, password, activo FROM usuarios WHERE correo = ?', [correo]);
      const account = rows[0];
      if (!account || !account.activo || !await verifyPassword(password, account.password)) {
        return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos, o cuenta inactiva.' });
      }
      if (!account.password.startsWith(PREFIX)) {
        const hash = await hashPassword(password);
        await pool.execute('UPDATE usuarios SET password = ? WHERE id_usuario = ? AND BINARY password = ?', [hash, account.id_usuario, account.password]);
      }
      const [users] = await pool.execute(`${USER_SQL} WHERE u.id_usuario = ? AND u.activo = 1`, [account.id_usuario]);
      if (!users.length) return res.status(401).json({ mensaje: 'La cuenta no está disponible.' });
      newSession(req, res, account.id_usuario);
      res.json({ usuario: publicUser(users[0]) });
    } catch (error) { next(error); }
  });

  router.get('/me', requireAuth, (req, res) => res.json({ usuario: req.usuario }));
  router.post('/logout', (req, res) => {
    sessions.delete(tokenFrom(req));
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ mensaje: 'Sesión cerrada.' });
  });
  return { router, requireAuth, close: () => clearInterval(cleanup) };
}
module.exports = { createAuth };
