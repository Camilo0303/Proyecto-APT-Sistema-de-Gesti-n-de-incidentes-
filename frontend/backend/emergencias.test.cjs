const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createEmergencias}=require('./emergencias.cjs');
test('Emergencias: permisos, validación, persistencia y transiciones',async()=>{
 let estado='Pendiente',dupe=false,insertadas=0,movimientos=0,rollback=0;
 const ids={'Pendiente':1,'En atención':2,'Atendida':3};
 const c={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{rollback++;},release:()=>{},execute:async(sql,args)=>{
  if(sql.startsWith('SELECT id_sala'))return [[...(args[0]==='QR-PM-W304'?[{id_sala:9}]:[])]];
  if(sql.startsWith('SELECT id_tipo_emergencia'))return [[{id_tipo_emergencia:1}]];
  if(sql.includes("WHERE nombre='Pendiente'"))return [[{id_estado_alerta:1}]];
  if(sql.startsWith('SELECT a.id_alerta'))return [dupe?[{id_alerta:7}]:[]];
  if(sql.startsWith('INSERT INTO alertas')){insertadas++;return [{insertId:7}];}
  if(sql.startsWith('SELECT id_estado_alerta,atendida_por'))return [[{id_estado_alerta:ids[estado],atendida_por:estado==='Pendiente'?null:2}]];
  if(sql.startsWith('SELECT nombre'))return [[{nombre:estado}]];
  if(sql.startsWith('SELECT id_estado_alerta'))return [[{id_estado_alerta:ids[args[0]]}]];
  if(sql.startsWith('UPDATE alertas')){estado=Object.keys(ids).find(k=>ids[k]===args[0]);return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO historial_alertas')){movimientos++;return [{affectedRows:1}];}
  throw Error(sql);
 }};
 const pool={getConnection:async()=>c,execute:async()=>[[]]};
 const auth=(req,res,next)=>{const rol=req.get('Test-Role');if(!rol)return res.status(401).end();req.usuario={rol,id_usuario:rol==='Profesor'?1:2};next();};
 const app=express();app.use(express.json());app.use('/api/emergencias',createEmergencias(pool,auth));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const base=`http://127.0.0.1:${server.address().port}/api/emergencias`;
 const post=(path,rol,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-SIGI-Request':'1',...(rol?{'Test-Role':rol}:{})},body:JSON.stringify(body)});
 const body={codigo_qr:'QR-PM-W304',id_tipo_emergencia:1};
 assert.equal((await post('',null,body)).status,401);
 assert.equal((await post('','Técnico',body)).status,403);
 assert.equal((await post('','Profesor',{})).status,400);
 assert.equal((await post('','Profesor',{...body,codigo_qr:'invalido'})).status,400);
 assert.equal((await post('','Profesor',body)).status,201);assert.equal(insertadas,1);
 dupe=true;assert.equal((await post('','Profesor',body)).status,200);assert.equal(insertadas,1);
 assert.equal((await post('/7/estado','Profesor',{estado:'En atención'})).status,403);
 assert.equal((await post('/7/estado','Enfermería',{estado:'Atendida'})).status,409);
 assert.equal((await post('/7/estado','Enfermería',{estado:'En atención'})).status,200);
 assert.equal((await post('/7/estado','Enfermería',{estado:'Atendida'})).status,200);
 assert.equal(movimientos,2);assert.ok(rollback>=2);
 }finally{await new Promise(r=>server.close(r));}
});
