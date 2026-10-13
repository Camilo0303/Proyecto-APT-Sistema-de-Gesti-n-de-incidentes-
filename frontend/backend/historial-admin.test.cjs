const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdministracion } = require('./administracion.cjs');

test('Historial administrativo: permisos, paginación y consulta de movimientos', async () => {
  const consultas = [];
  const pool = { execute: async (sql, params) => {
    consultas.push({ sql, params });
    if (sql.includes('COUNT(*)')) return [[{ total: 21 }]];
    if (sql.includes('FROM historial_incidencias')) return [[{ id_historial: 1, tipo_movimiento: 'CREACION' }]];
    if (sql.startsWith('SELECT id_incidencia')) return [params[0] === 52 ? [{ id_incidencia: 52, titulo: 'Prueba' }] : []];
    return [[{ id_incidencia: 52 }]];
  } };
  const auth = (req, res, next) => {
    if (!req.get('Test-Role')) return res.status(401).end();
    req.usuario = { rol: req.get('Test-Role') }; next();
  };
  const app = express();
  app.use('/api/admin', createAdministracion(pool, auth));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/admin`;
    const get = (path, role = 'Administrador') => fetch(base + path, { headers: role ? { 'Test-Role': role } : {} });
    assert.equal((await get('/incidencias', null)).status, 401);
    assert.equal((await get('/incidencias', 'Profesor')).status, 403);
    assert.equal((await get('/incidencias/52/historial', 'Técnico')).status, 403);
    assert.equal((await get('/incidencias?pagina=-1')).status, 400);
    assert.equal((await get('/incidencias/abc/historial')).status, 400);
    const pagina = await (await get('/incidencias?pagina=2')).json();
    assert.equal(pagina.total, 21);
    assert.equal(pagina.paginas, 2);
    assert.match(consultas.at(-1).sql, /LIMIT 20 OFFSET 20/);
    assert.equal((await get('/incidencias/999/historial')).status, 404);
    const historial = await (await get('/incidencias/52/historial')).json();
    assert.equal(historial.incidencia.id_incidencia, 52);
    assert.equal(historial.historial[0].tipo_movimiento, 'CREACION');
    assert.deepEqual(consultas.at(-1).params, [52]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
