import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearPulsacion } from './mantenerPulsado.js';

function preparar() {
  let tiempo = 0, secuencia = 0, envios = 0, avance = 0;
  const pendientes = new Map();
  const control = crearPulsacion({
    activar: () => { envios++; }, progreso: p => { avance = p; }, reloj: () => tiempo,
    programar: (fn, demora) => { const id = ++secuencia; pendientes.set(id, { fn, cuando: tiempo + demora }); return id; },
    cancelar: id => pendientes.delete(id),
  });
  function avanzar(ms) {
    const fin = tiempo + ms;
    while (true) {
      const siguiente = [...pendientes.entries()].sort((a, b) => a[1].cuando - b[1].cuando)[0];
      if (!siguiente || siguiente[1].cuando > fin) break;
      tiempo = siguiente[1].cuando; pendientes.delete(siguiente[0]); siguiente[1].fn();
    }
    tiempo = fin;
  }
  return { control, avanzar, envios: () => envios, avance: () => avance };
}

test('Solo activa una vez al completar cinco segundos continuos', () => {
  const r = preparar(); r.control.iniciar(); r.avanzar(4999);
  assert.equal(r.envios(), 0); assert.ok(r.avance() > 0);
  r.avanzar(1); assert.equal(r.envios(), 1);
  r.avanzar(10000); assert.equal(r.envios(), 1);
});
test('Soltar, perder foco o cancelar antes del plazo impide el envío', () => {
  const r = preparar(); r.control.iniciar(); r.avanzar(4900); r.control.detener();
  r.avanzar(10000); assert.equal(r.envios(), 0); assert.equal(r.avance(), 0);
  r.control.iniciar(); r.avanzar(4999); assert.equal(r.envios(), 0);
  r.avanzar(1); assert.equal(r.envios(), 1);
});
test('Repetir el inicio no acelera ni duplica la activación', () => {
  const r = preparar(); r.control.iniciar(); r.avanzar(2000); r.control.iniciar();
  r.avanzar(2999); assert.equal(r.envios(), 0);
  r.avanzar(1); assert.equal(r.envios(), 1);
});
