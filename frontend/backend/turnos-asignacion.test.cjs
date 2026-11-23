const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTurnos } = require('./turnos.cjs');

function escenario() {
  let estado = {
    turnos: [4],
    reportes: [
      { id: 10, estado: 1, responsable: null },
      { id: 11, estado: 1, responsable: null },
      { id: 12, estado: 1, responsable: null },
      { id: 90, estado: 2, responsable: 4 },
    ],
    historial: [],
  };
  let respaldo;
  let fallaHistorial = false;
  const conexion = {
    query: async () => {},
    beginTransaction: async () => { respaldo = structuredClone(estado); },
    commit: async () => {},
    rollback: async () => { estado = respaldo; },
    release: () => {},
    execute: async (sql, args = []) => {
      if (sql.includes('AS abiertas')) {
        const candidatos = estado.turnos.map(id => ({
          id_usuario: id,
          nombre: `Técnico ${id}`,
          abiertas: estado.reportes.filter(r => r.responsable === id && r.estado <= 3).length,
        }));
        candidatos.sort((a, b) => a.abiertas - b.abiertas || a.id_usuario - b.id_usuario);
        return [candidatos.slice(0, 1)];
      }
      if (sql.startsWith('SELECT u.id_usuario')) return [[{ id_usuario: 5 }]];
      if (sql.startsWith('SELECT id_turno')) return [estado.turnos.includes(5) ? [{ id_turno: 5 }] : []];
      if (sql.startsWith('INSERT INTO turnos_tecnicos')) estado.turnos.push(5);
      if (sql.startsWith('SELECT i.id_incidencia')) {
        return [estado.reportes
          .filter(r => r.responsable === null && r.estado === 1 && (!args.length || r.id === args[0]))
          .map(r => ({ id_incidencia: r.id }))];
      }
      if (sql.includes("WHERE nombre='Asignada'")) return [[{ id_estado: 2 }]];
      if (sql.startsWith('SELECT id_estado FROM incidencias')) {
        return [[{ id_estado: estado.reportes.find(r => r.id === args[0]).estado }]];
      }
      if (sql.startsWith('UPDATE incidencias')) {
        const reporte = estado.reportes.find(r => r.id === args[2]);
        reporte.responsable = args[0];
        reporte.estado = args[1];
      }
      if (sql.includes('INSERT INTO historial_incidencias')) {
        if (fallaHistorial) throw Error('Fallo al guardar historial');
        estado.historial.push(args);
      }
      return [{ affectedRows: 1 }];
    },
  };
  return {
    pool: { getConnection: async () => conexion },
    obtener: () => estado,
    fallar: valor => { fallaHistorial = valor; },
  };
}

async function conServidor(escena, comprobar) {
  const app = express();
  app.use(express.json());
  app.use('/turno', createTurnos(escena.pool, (req, res, next) => {
    req.usuario = { id_usuario: 5, rol: 'Técnico' };
    next();
  }));
  app.use((error, req, res, next) => res.status(500).json({ mensaje: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const iniciar = () => fetch(`http://127.0.0.1:${server.address().port}/turno`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SIGI-Request': '1' },
    body: JSON.stringify({ en_turno: true }),
  });
  try { await comprobar(iniciar); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('Iniciar turno reparte pendientes por carga y repetirlo conserva responsables e historial', async () => {
  const escena = escenario();
  await conServidor(escena, async iniciar => {
    const respuesta = await iniciar();
    assert.equal(respuesta.status, 200);
    assert.equal((await respuesta.json()).asignadas, 3);
    const estado = escena.obtener();
    assert.equal(estado.reportes.find(r => r.id === 10).responsable, 5);
    assert.equal(estado.reportes.find(r => r.id === 90).responsable, 4);
    assert.equal(estado.reportes.filter(r => r.responsable === 4).length, 2);
    assert.equal(estado.reportes.filter(r => r.responsable === 5).length, 2);
    assert.deepEqual(estado.historial.map(h => h[0]), [10, 11, 12]);
    assert.ok(estado.historial.every(h => h[1] === 'ASIGNACION_AUTOMATICA' && h[4] === 5));
    const antes = structuredClone(estado);
    assert.equal((await (await iniciar()).json()).asignadas, 0);
    assert.deepEqual(escena.obtener(), antes);
  });
});

test('Un error de historial revierte el turno y el reparto y permite reintentar', async () => {
  const escena = escenario();
  const antes = structuredClone(escena.obtener());
  escena.fallar(true);
  await conServidor(escena, async iniciar => {
    assert.equal((await iniciar()).status, 500);
    assert.deepEqual(escena.obtener(), antes);
    escena.fallar(false);
    assert.equal((await (await iniciar()).json()).asignadas, 3);
    assert.equal(escena.obtener().historial.length, 3);
  });
});
