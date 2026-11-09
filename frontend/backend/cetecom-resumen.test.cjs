const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createCetecom } = require('./cetecom.cjs');

test('Resumen y listado comparten filtros; el resumen no se limita a una página', async () => {
  const consultas = [];
  const conexion = {
    query: async () => {}, beginTransaction: async () => {},
    commit: async () => {}, rollback: async () => {}, release() {},
    execute: async (sql, params) => {
      consultas.push({ sql, params });
      if (sql.includes('AS pendientes')) return [[{ total: 25, pendientes: 25, en_atencion: 0, finalizadas: 0, anuladas: 0 }]];
      if (sql.includes('COUNT(*)')) return [[{ total: 25 }]];
      return [[{ id_incidencia: 21 }]];
    },
  };
  const app = express();
  app.use(createCetecom({ getConnection: async () => conexion }, (req, _res, next) => {
    req.usuario = { id_usuario: 1, rol: 'Técnico' }; next();
  }));
  app.use((e, _req, res, _next) => res.status(e.status || 500).json({ mensaje: e.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}/incidencias`;
    const r = await fetch(`${base}?desde=2026-11-03&hasta=2026-12-03&sala=9&categoria=1&estado=Pendiente&prioridad=3&buscar=proyector&pagina=2`);
    assert.equal(r.status, 200);
    const datos = await r.json();
    assert.equal(datos.resumen.total, 25);
    assert.equal(datos.incidencias.length, 1);
    assert.equal(datos.paginas, 2);
    for (const q of consultas) {
      assert.deepEqual(q.params, ['2026-11-03 00:00:00', '2026-12-03 23:59:59.999999', 9, 1, 'Pendiente', 3, 'proyector']);
      assert.match(q.sql, /i.fecha_creacion >= \?/);
      assert.match(q.sql, /i.fecha_creacion <= \?/);
    }
    assert.match(consultas[1].sql, /LIMIT 20 OFFSET 20/);
    assert.doesNotMatch(consultas[2].sql, /LIMIT/);
    consultas.length = 0;
    assert.equal((await fetch(`${base}?estado=todas`)).status, 200);
    assert.deepEqual(consultas[2].params, []);
    assert.doesNotMatch(consultas[2].sql, /WHERE/);
    assert.equal((await fetch(`${base}?desde=2026-12-03&hasta=2026-11-03`)).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise(r => server.close(r));
  }
});
