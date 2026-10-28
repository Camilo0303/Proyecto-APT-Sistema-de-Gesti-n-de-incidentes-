const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { filtrarIncidencias, ordenFecha, leerPagina } = require('./filtros-incidencias.cjs');
const { createIncidencias } = require('./incidencias.cjs');

test('Rango inclusivo, filtros combinados y parámetros separados del SQL', () => {
  const f = filtrarIncidencias({ desde: '2024-02-29', hasta: '2024-03-01', sala: '9', categoria: '1', estado: 'Resuelta' });
  assert.equal(f.condiciones.length, 5);
  assert.deepEqual(f.parametros, ['2024-02-29 00:00:00', '2024-03-01 23:59:59.999999', 9, 1, 'Resuelta']);
  assert.ok(!f.donde.includes('Resuelta'));
  assert.equal(filtrarIncidencias({}).donde, '');
  assert.equal(filtrarIncidencias({ estado: 'activas', sala: '9' }, false).condiciones.length, 1);
  assert.equal(ordenFecha({ orden: 'antiguas' }), 'ASC');
});
test('Rechaza fechas inexistentes, rango invertido, arrays e intentos de inyección', () => {
  for (const q of [{ desde: '2025-02-29' }, { hasta: '2026-04-31' }, { desde: '2026-10-28', hasta: '2026-10-01' }, { sala: '9 OR 1=1' }, { categoria: ['1'] }, { estado: 'desconocido' }, { desde: 'hoy' }]) {
    assert.throws(() => filtrarIncidencias(q), e => e.status === 400);
  }
  assert.throws(() => leerPagina({ pagina: '-1' }));
  assert.throws(() => ordenFecha({ orden: 'DROP TABLE incidencias' }));
});
test('Profesor: los filtros no permiten acceder a reportes ajenos y se aplican antes de paginar', async () => {
  const consultas = [];
  const pool = { execute: async (sql, params) => {
    consultas.push({ sql, params });
    return sql.includes('COUNT(*)') ? [[{ total: 21 }]] : [[{ id_incidencia: 52 }]];
  } };
  const app = express();
  app.use('/api/incidencias', createIncidencias(pool, (req, _res, next) => { req.usuario = { id_usuario: 52 }; next(); }));
  app.use((e, _req, res, _next) => res.status(e.status || 500).json({ mensaje: e.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/incidencias/mias`;
    const respuesta = await fetch(`${base}?sala=9&categoria=1&estado=Pendiente&pagina=2&id_usuario_creador=99`);
    assert.equal(respuesta.status, 200);
    const r = await respuesta.json(); assert.equal(r.total, 21); assert.equal(r.paginas, 2);
    for (const q of consultas) { assert.match(q.sql, /WHERE i.id_usuario_creador = \?/); assert.deepEqual(q.params, [52, 9, 1, 'Pendiente']); }
    assert.match(consultas[1].sql, /LIMIT 20 OFFSET 20/);
    assert.equal((await fetch(`${base}?desde=2026-02-30`)).status, 400);
  } finally { await new Promise(r => server.close(r)); }
});
