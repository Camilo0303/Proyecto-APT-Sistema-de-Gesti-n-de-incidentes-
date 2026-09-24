const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { createAuth } = require('./auth.cjs');
const { hashPassword, verifyPassword } = require('./passwords.cjs');

test('Hash con sal, contraseña incorrecta y compatibilidad inicial', async () => {
  const hash = await hashPassword('Prueba-segura-123');
  assert.notEqual(hash, await hashPassword('Prueba-segura-123'));
  assert.equal(await verifyPassword('Prueba-segura-123', hash), true);
  assert.equal(await verifyPassword('incorrecta', hash), false);
  assert.equal(await verifyPassword('incorrecta', 'scrypt$bad$bad'), false);
  assert.equal(await verifyPassword('123456', '123456'), true);
});

test('Registro y sesiones contra MySQL (datos temporales)', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, connectionLimit: 3, connectTimeout: 5000,
  });
  const auth = createAuth(pool);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', auth.router);
  app.use((err, _req, res, _next) => res.status(500).json({ code: err.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/auth`;
  const suffix = randomBytes(10).toString('hex');
  const correo = `codex-test-${suffix}@example.invalid`;
  const legacy = `codex-legacy-${suffix}@example.invalid`;
  let cookie = '';
  async function request(route, body, extra = {}) {
    const response = await fetch(url + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-SIGI-Request': '1', Cookie: cookie, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, data: await response.json(), setCookie };
  }
  try {
    const [roles] = await pool.execute("SELECT id_rol FROM roles WHERE nombre = 'Profesor'");
    assert.equal(roles.length, 1);
    const role = roles[0].id_rol;
    const datos = { nombre: 'Prueba', apellido: 'Temporal', correo, password: 'Prueba-segura-123', id_rol: 1 };
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/registro', datos)).status, 403);
    await pool.execute('INSERT INTO correos_autorizados (correo, id_rol, activo) VALUES (?, ?, 0)', [correo, role]);
    assert.equal((await request('/registro', datos)).status, 403);
    await pool.execute('UPDATE correos_autorizados SET activo = 1 WHERE correo = ?', [correo]);
    assert.equal((await request('/registro', { ...datos, password: 'short' })).status, 400);
    assert.equal((await request('/registro', datos, { 'X-SIGI-Request': '' })).status, 403);
    const registro = await request('/registro', datos);
    assert.equal(registro.status, 201);
    assert.equal(registro.data.usuario.id_rol, role);
    assert.equal('password' in registro.data.usuario, false);
    assert.match(registro.setCookie, /HttpOnly/);
    assert.match(registro.setCookie, /SameSite=Strict/);
    const [stored] = await pool.execute('SELECT password FROM usuarios WHERE correo = ?', [correo]);
    assert.match(stored[0].password, /^scrypt\$/);
    assert.equal((await request('/me')).status, 200);
    assert.equal((await request('/registro', datos)).status, 409);
    const oldCookie = cookie;
    assert.equal((await request('/logout', {})).status, 200);
    assert.equal((await request('/me', undefined, { Cookie: oldCookie })).status, 401);
    assert.equal((await request('/login', { correo, password: 'incorrecta' })).status, 401);
    assert.equal((await request('/login', { correo: correo.toUpperCase(), password: datos.password })).status, 200);
    await pool.execute('UPDATE usuarios SET activo = 0 WHERE correo = ?', [correo]);
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/login', { correo, password: datos.password })).status, 401);
    await pool.execute('INSERT INTO usuarios (nombre, apellido, correo, password, id_rol) VALUES (?, ?, ?, ?, ?)', ['Prueba', 'Temporal', legacy, '123456', role]);
    assert.equal((await request('/login', { correo: legacy, password: '123456' })).status, 200);
    const [migrated] = await pool.execute('SELECT password FROM usuarios WHERE correo = ?', [legacy]);
    assert.match(migrated[0].password, /^scrypt\$/);
    assert.equal(await verifyPassword('123456', migrated[0].password), true);
    assert.equal((await request('/login', { correo: legacy, password: '123456' })).status, 200);
  } finally {
    // Only delete the uniquely named records created by this test.
    try {
      await pool.execute('DELETE FROM usuarios WHERE correo IN (?, ?)', [correo, legacy]);
      await pool.execute('DELETE FROM correos_autorizados WHERE correo = ?', [correo]);
    } finally {
      auth.close();
      await new Promise(resolve => server.close(resolve));
      await pool.end();
    }
  }
});
