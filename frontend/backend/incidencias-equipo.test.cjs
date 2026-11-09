const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createIncidencias } = require('./incidencias.cjs');

test('Nuevas incidencias: equipo nulo incluso desde clientes anteriores y creador de la sesión', async () => {
  const consultas = [];
  const app = express();
  app.use(express.json());
  app.use('/incidencias', createIncidencias({ execute: async (sql, params) => {
    consultas.push({ sql, params }); return [{ affectedRows: 1, insertId: 56 }];
  } }, (req, res, next) => { req.usuario = { rol: 'Profesor', id_usuario: 52 }; next(); }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    for (const equipo of [undefined, null, 7]) {
      const respuesta = await fetch(`http://127.0.0.1:${server.address().port}/incidencias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SIGI-Request': '1' },
        body: JSON.stringify({ titulo: 'Proyector sin imagen', id_sala: 9, id_categoria: 1, id_prioridad: 2, id_equipo: equipo, id_usuario_creador: 999 }),
      });
      assert.equal(respuesta.status, 201);
      const q = consultas.at(-1);
      assert.match(q.sql, /SELECT\s+\?, \?, \?, NULL,/);
      assert.deepEqual(q.params, ['Proyector sin imagen', null, 52, 1, 2, 9]);
    }
  } finally { await new Promise(r => server.close(r)); }
});
