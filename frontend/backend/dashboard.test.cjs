const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdministracion } = require('./administracion.cjs');
const { celdaCSV } = require('./dashboard.cjs');

test('CSV conserva comillas, saltos, acentos y neutraliza fórmulas', () => {
  assert.equal(celdaCSV('Sala "Árbol", W\nPiso 1'), '"Sala ""Árbol"", W\nPiso 1"');
  assert.equal(celdaCSV(' =HYPERLINK("x")'), '"\' =HYPERLINK(""x"")"');
  assert.equal(celdaCSV(null), '""');
  assert.equal(celdaCSV(52), '"52"');
});

test('Dashboard y CSV: permisos, filtros comunes, lectura consistente y exportación completa', async () => {
  const consultas = [], transacciones = [];
  let pagina = 0;
  const conexion = {
    query: async sql => { transacciones.push(sql); },
    commit: async () => transacciones.push('COMMIT'),
    rollback: async () => transacciones.push('ROLLBACK'),
    release: () => transacciones.push('RELEASE'),
    execute: async (sql, params) => {
      consultas.push({ sql, params });
      if (sql.includes('LIMIT 1000')) return [pagina++ === 0 ? [{ id_incidencia: 52, titulo: '=1+1', estado: 'Pendiente' }] : []];
      if (sql.includes('horas_resolucion')) return [[{ total: 1, horas_resolucion: null, muestra_resolucion: 0 }]];
      return [[]];
    },
  };
  const app = express();
  app.use('/admin', createAdministracion({ getConnection: async () => conexion }, (req, res, next) => {
    if (!req.get('Test-Role')) return res.status(401).end();
    req.usuario = { rol: req.get('Test-Role') }; next();
  }));
  app.use((error, req, res, next) => { if (res.headersSent) return next(error); res.status(error.status || 500).json({ mensaje: error.message }); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}/admin/dashboard`;
    const get = (path = '', rol = 'Administrador') => fetch(base + path, { headers: rol ? { 'Test-Role': rol } : {} });
    assert.equal((await get('', null)).status, 401);
    assert.equal((await get('', 'Profesor')).status, 403);
    assert.equal((await get('/exportar', 'Técnico')).status, 403);
    assert.equal((await get('?desde=2026-02-30')).status, 400);
    assert.equal(consultas.length, 0);
    const filtros = '?desde=2026-01-01&hasta=2026-10-28&sala=9&categoria=1&estado=Pendiente';
    const respuesta = await get(filtros);
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).resumen.total, 1);
    assert.equal(consultas.length, 7);
    const params = ['2026-01-01 00:00:00','2026-10-28 23:59:59.999999',9,1,'Pendiente'];
    for (const q of consultas) assert.deepEqual(q.params, params);
    assert.match(consultas[0].sql, /fecha_cierre >= i.fecha_creacion/);
    assert.match(transacciones[1], /CONSISTENT SNAPSHOT, READ ONLY/);
    const csv = await get('/exportar' + filtros);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /attachment/);
    const contenido = await csv.text();
    assert.match(contenido, /id_incidencia,titulo,fecha_creacion/);
    assert.match(contenido, /"52","'=1\+1"/);
    assert.deepEqual(consultas.at(-1).params, [...params,52]);
    assert.equal(transacciones.filter(t => t === 'COMMIT').length, 2);
    assert.equal(transacciones.filter(t => t === 'RELEASE').length, 2);
  } finally { await new Promise(r => server.close(r)); }
});
