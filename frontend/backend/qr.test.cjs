const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIncidencias } = require('./incidencias.cjs');
const { createAdministracion } = require('./administracion.cjs');
const { permitirRoles } = require('./permisos.cjs');

test('QR: sesión, permisos, código inválido, sala desconocida y sala válida', async () => {
  const consultas = [];
  const pool = { execute: async (sql, params) => {
    consultas.push({ sql, params });
    if (!params) return [[{ id_sala: 9, codigo_qr: 'QR-PM-W304' }]];
    return [params[0] === 'QR-PM-W304' ? [{ id_sala: 9, nombre: 'PM-W304', piso: 3, edificio: 'W' }] : []];
  } };
  const auth = (req, res, next) => {
    if (!req.get('Test-Role')) return res.status(401).end();
    req.usuario = { rol: req.get('Test-Role') }; next();
  };
  const app = express();
  app.use('/api/incidencias', auth, permitirRoles('Profesor', 'Administrador'), createIncidencias(pool, auth));
  app.use('/api/admin', createAdministracion(pool, auth));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    const get = (path, role) => fetch(url + path, { headers: role ? { 'Test-Role': role } : {} });
    assert.equal((await get('/api/incidencias/sala-qr?codigo=QR-PM-W304')).status, 401);
    assert.equal((await get('/api/incidencias/sala-qr?codigo=QR-PM-W304', 'Técnico')).status, 403);
    assert.equal((await get('/api/incidencias/sala-qr', 'Profesor')).status, 400);
    assert.equal((await get('/api/incidencias/sala-qr?codigo=inexistente', 'Profesor')).status, 404);
    const respuesta = await get('/api/incidencias/sala-qr?codigo=QR-PM-W304', 'Profesor');
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).sala.id_sala, 9);
    assert.equal((await get('/api/admin/salas-qr', 'Profesor')).status, 403);
    assert.equal((await get('/api/admin/salas-qr', 'Administrador')).status, 200);
    assert.match(consultas[0].sql, /s\.activo = 1/);
    assert.deepEqual(consultas[1].params, ['QR-PM-W304']);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
