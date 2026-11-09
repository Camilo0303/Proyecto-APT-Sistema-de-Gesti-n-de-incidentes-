const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAdministracion } = require('./administracion.cjs');

test('Turnos administrativos: acceso restringido y consulta de técnicos habilitados con turno vigente', async () => {
  let vacio = false;
  const consultas = [];
  const app = express();
  app.use('/admin', createAdministracion({execute:async sql=>{
    consultas.push(sql);
    return [vacio ? [] : [{id_usuario:4,nombre:'Carlos',apellido:'Pérez',inicio:'09/11/2026 09:00:00',vence:'09/11/2026 17:00:00'}]];
  }},(req,res,next)=>{
    if(!req.get('Test-Role'))return res.status(401).end();
    req.usuario={id_usuario:1,rol:req.get('Test-Role')};next();
  }));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const base=`http://127.0.0.1:${server.address().port}/admin/tecnicos-en-turno`;
    const get=rol=>fetch(base,{headers:rol?{'Test-Role':rol}:{}});
    assert.equal((await get()).status,401);
    for(const rol of ['Profesor','Técnico','Enfermería'])assert.equal((await get(rol)).status,403);
    assert.equal(consultas.length,0);
    const r=await get('Administrador');assert.equal(r.status,200);
    assert.equal(r.headers.get('cache-control'),'no-store');
    assert.equal((await r.json()).tecnicos[0].id_usuario,4);
    assert.match(consultas[0],/u.activo=1 AND r.nombre='Técnico'/);
    assert.match(consultas[0],/actual.fecha_fin IS NULL AND actual.vence>NOW\(\)/);
    assert.match(consultas[0],/MAX\(actual.id_turno\)/);
    vacio=true;assert.deepEqual((await (await get('Administrador')).json()).tecnicos,[]);
  } finally {await new Promise(r=>server.close(r));}
});
