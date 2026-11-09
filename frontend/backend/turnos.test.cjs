const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createTurnos } = require('./turnos.cjs');
const { createAuth } = require('./auth.cjs');
const { hashPassword } = require('./passwords.cjs');

test('Turnos: permisos, id de sesión, inicio idempotente y fin sin desactivar cuenta', async () => {
  let enTurno = false, altas = 0;
  const consultas = [];
  const ejecutar = async (sql,args) => {
    consultas.push({sql,args});
    if (sql.startsWith('SELECT u.id_usuario')) return [[{id_usuario:4}]];
    if (sql.startsWith('SELECT id_turno')) return [enTurno ? [{id_turno:1,inicio:'2026-11-09 09:00:00',vence:'2026-11-09 17:00:00'}] : []];
    if (sql.startsWith('INSERT')) { altas++; enTurno=true; }
    if (sql.includes('fecha_fin=NOW()')) enTurno=false;
    return [{affectedRows:1}];
  };
  const c={execute:ejecutar,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}};
  const app=express(); app.use(express.json());
  app.use('/turno',createTurnos({execute:ejecutar,getConnection:async()=>c},(req,res,next)=>{
    if (!req.get('Test-Role')) return res.status(401).end();
    req.usuario={id_usuario:4,rol:req.get('Test-Role')};next();
  }));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const base=`http://127.0.0.1:${server.address().port}/turno`;
    const post=(body,rol='Técnico',extra={})=>fetch(base,{method:'POST',headers:{'Test-Role':rol,'Content-Type':'application/json','X-SIGI-Request':'1',...extra},body:JSON.stringify(body)});
    assert.equal((await fetch(base)).status,401);
    assert.equal((await post({en_turno:true},'Profesor')).status,403);
    assert.equal((await post({en_turno:true},'Técnico',{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await post({en_turno:1})).status,400);
    assert.equal((await post({en_turno:true,id_usuario:999})).status,200);
    assert.equal((await post({en_turno:true})).status,200);assert.equal(altas,1);
    const actual=await (await fetch(base,{headers:{'Test-Role':'Técnico'}})).json();assert.equal(actual.en_turno,true);
    assert.equal((await post({en_turno:false})).status,200);assert.equal(enTurno,false);
    for(const q of consultas) assert.equal(q.args[0],4);
    assert.ok(consultas.some(q=>q.sql.includes('FOR UPDATE')));
    assert.ok(!consultas.some(q=>q.sql.startsWith('UPDATE usuarios')));
  } finally {await new Promise(r=>server.close(r));}
});

test('Cerrar sesión técnica finaliza turno; si falla, conserva la sesión para reintentar', async () => {
  const password=await hashPassword('Clave-prueba-123');
  const pool={execute:async sql => sql.includes('SELECT id_usuario, password, activo')
    ? [[{id_usuario:4,password,activo:1}]] : [[{id_usuario:4,nombre:'Técnico',apellido:'Prueba',rol:'Técnico',activo:1}]]};
  let falla=true, cierres=0;
  const auth=createAuth(pool,{alCerrarTurno:async id=>{assert.equal(id,4);cierres++;if(falla)throw Error('Fallo temporal');}});
  const app=express();app.use(express.json());app.use('/auth',auth.router);
  app.use((err,req,res,next)=>{if(res.headersSent)return next(err);res.status(500).json({mensaje:'No se pudo finalizar el turno.'});});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try {
    const base=`http://127.0.0.1:${server.address().port}/auth`;
    const headers={'Content-Type':'application/json','X-SIGI-Request':'1'};
    const login=await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({correo:'tecnico@colegio.cl',password:'Clave-prueba-123'})});
    assert.equal(login.status,200);headers.Cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base+'/logout',{method:'POST',headers,body:'{}'})).status,500);
    assert.equal((await fetch(base+'/me',{headers})).status,200);
    falla=false;
    assert.equal((await fetch(base+'/logout',{method:'POST',headers,body:'{}'})).status,200);
    assert.equal(cierres,2);
    assert.equal((await fetch(base+'/me',{headers})).status,401);
  } finally {auth.close();await new Promise(r=>server.close(r));}
});
