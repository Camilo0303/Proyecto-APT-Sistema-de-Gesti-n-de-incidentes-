const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createIncidencias}=require('./incidencias.cjs');

test('Asignación: registro atómico, historial, falta de técnicos y reversión de errores',async()=>{
  let disponible=true,fallo=false,referencias=true,commits=0,rollbacks=0,liberadas=0;
  const consultas=[];
  const c={query:async sql=>consultas.push({sql}),beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},release:()=>{liberadas++;},execute:async(sql,args)=>{
    consultas.push({sql,args});
    if(sql.includes('INSERT INTO incidencias'))return [{affectedRows:referencias?1:0,insertId:56}];
    if(sql.includes('AS abiertas'))return [disponible?[{id_usuario:4,nombre:'Técnico elegido',abiertas:2}]:[]];
    if(sql.startsWith('SELECT u.id_usuario'))return [[{id_usuario:4}]];
    if(sql.includes("WHERE nombre='Asignada'"))return [[{id_estado:2}]];
    if(sql.startsWith('SELECT id_estado FROM incidencias'))return [[{id_estado:1}]];
    if(sql.includes('INSERT INTO historial_incidencias')&&fallo)throw Error('Historial no disponible');
    return [{affectedRows:1}];
  }};
  const app=express();app.use(express.json());app.use('/incidencias',createIncidencias({getConnection:async()=>c},(req,res,next)=>{req.usuario={id_usuario:52,rol:'Profesor'};next();}));
  app.use((e,req,res,next)=>{if(res.headersSent)return next(e);res.status(500).json({mensaje:'No se pudo guardar.'});});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{
    const post=()=>fetch(`http://127.0.0.1:${server.address().port}/incidencias`,{method:'POST',headers:{'Content-Type':'application/json','X-SIGI-Request':'1'},body:JSON.stringify({titulo:'Prueba',id_sala:9,id_categoria:1,id_prioridad:2,id_responsable:999})});
    const r=await post();assert.equal(r.status,201);const d=await r.json();assert.equal(d.responsable.id_usuario,4);assert.equal(d.estado,'Asignada');assert.equal(commits,1);
    assert.match(consultas.find(q=>q.sql.includes('FOR UPDATE')).sql,/ORDER BY u.id_usuario FOR UPDATE/);
    const eleccion=consultas.find(q=>q.sql.includes('AS abiertas')).sql;
    assert.match(eleccion,/u.activo=1 AND r.nombre='Técnico'/);
    assert.match(eleccion,/fecha_fin IS NULL AND t.vence>NOW\(\)/);
    assert.match(eleccion,/ORDER BY abiertas,ultima_asignacion,u.id_usuario/);
    assert.deepEqual(consultas.find(q=>q.sql.startsWith('UPDATE incidencias')).args,[4,2,56]);
    const h=consultas.find(q=>q.sql.includes('INSERT INTO historial_incidencias')).args;
    assert.deepEqual(h.slice(0,6),[56,'ASIGNACION_AUTOMATICA',1,2,52,4]);
    disponible=false;const antes=consultas.length;const pendiente=await(await post()).json();assert.equal(pendiente.responsable,null);assert.equal(pendiente.estado,'Pendiente');
    assert.ok(!consultas.slice(antes).some(q=>q.sql.startsWith('UPDATE incidencias')));
    disponible=true;fallo=true;assert.equal((await post()).status,500);assert.equal(commits,2);assert.equal(rollbacks,1);
    fallo=false;referencias=false;assert.equal((await post()).status,400);assert.equal(commits,2);assert.equal(rollbacks,2);assert.equal(liberadas,4);
  }finally{await new Promise(r=>server.close(r));}
});
