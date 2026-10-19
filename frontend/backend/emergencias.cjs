const express = require('express');
const { permitirRoles } = require('./permisos.cjs');

function createEmergencias(pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const leer = `SELECT a.id_alerta, a.descripcion, a.atendida_por,
    DATE_FORMAT(a.fecha_alerta,'%d/%m/%Y %H:%i:%s') AS fecha,
    s.nombre AS sala, s.codigo_sala, e.nombre AS edificio, p.numero_piso AS piso,
    t.nombre AS tipo, ea.nombre AS estado,
    CONCAT(u.nombre,' ',u.apellido) AS profesor,
    CONCAT(r.nombre,' ',r.apellido) AS responsable
    FROM alertas a JOIN salas s ON s.id_sala=a.id_sala
    JOIN pisos p ON p.id_piso=s.id_piso JOIN edificios e ON e.id_edificio=p.id_edificio
    JOIN tipos_emergencia t ON t.id_tipo_emergencia=a.id_tipo_emergencia
    JOIN estados_alerta ea ON ea.id_estado_alerta=a.id_estado_alerta
    JOIN usuarios u ON u.id_usuario=a.id_usuario
    LEFT JOIN usuarios r ON r.id_usuario=a.atendida_por`;
  router.get('/catalogos', permitirRoles('Profesor'), async (_req,res,next) => {
    try { const [tipos] = await pool.execute('SELECT id_tipo_emergencia,nombre FROM tipos_emergencia ORDER BY id_tipo_emergencia'); res.json({tipos}); }
    catch(e) { next(e); }
  });
  router.get('/mias', permitirRoles('Profesor'), async (req,res,next) => {
    try { const [alertas]=await pool.execute(`${leer} WHERE a.id_usuario=? ORDER BY a.fecha_alerta DESC,a.id_alerta DESC LIMIT 20`,[req.usuario.id_usuario]); res.json({alertas}); }
    catch(e) { next(e); }
  });
  router.get('/', permitirRoles('Enfermería'), async (_req,res,next) => {
    try {
      const [alertas]=await pool.execute(`${leer} WHERE ea.nombre IN ('Pendiente','En atención') ORDER BY a.fecha_alerta ASC,a.id_alerta ASC`);
      const [atendidas]=await pool.execute(`${leer} WHERE ea.nombre='Atendida' ORDER BY a.fecha_alerta DESC,a.id_alerta DESC LIMIT 20`);
      res.json({alertas,atendidas});
    } catch(e) { next(e); }
  });
  router.use((req,res,next) => {
    if(req.method==='POST' && (!req.is('application/json') || req.get('X-SIGI-Request')!=='1' || req.get('Sec-Fetch-Site')==='cross-site')) return res.status(403).json({mensaje:'Solicitud no permitida.'});
    next();
  });
  router.post('/', permitirRoles('Profesor'), async (req,res,next) => {
    const {codigo_qr,id_tipo_emergencia,descripcion=''}=req.body||{};
    if(typeof codigo_qr!=='string' || !codigo_qr.trim() || codigo_qr.length>150 || !Number.isSafeInteger(id_tipo_emergencia) || id_tipo_emergencia<1 || typeof descripcion!=='string' || descripcion.length>255) return res.status(400).json({mensaje:'Escanea una sala válida y selecciona el tipo de emergencia. Descripción: máximo 255 caracteres.'});
    let c;
    try {
      c=await pool.getConnection(); await c.beginTransaction();
      const [[sala]]=await c.execute('SELECT id_sala FROM salas WHERE BINARY codigo_qr=? AND activo=1 FOR UPDATE',[codigo_qr.trim()]);
      const [[tipo]]=await c.execute('SELECT id_tipo_emergencia FROM tipos_emergencia WHERE id_tipo_emergencia=?',[id_tipo_emergencia]);
      const [[estado]]=await c.execute("SELECT id_estado_alerta FROM estados_alerta WHERE nombre='Pendiente'");
      if(!sala||!tipo||!estado) { await c.rollback(); return res.status(400).json({mensaje:'La sala, tipo o estado inicial no está disponible.'}); }
      const [[existente]]=await c.execute(`SELECT a.id_alerta FROM alertas a JOIN estados_alerta e ON e.id_estado_alerta=a.id_estado_alerta WHERE a.id_usuario=? AND a.id_sala=? AND a.id_tipo_emergencia=? AND e.nombre IN ('Pendiente','En atención') ORDER BY a.id_alerta DESC LIMIT 1`,[req.usuario.id_usuario,sala.id_sala,id_tipo_emergencia]);
      if(existente) { await c.commit(); return res.json({id_alerta:existente.id_alerta,mensaje:'Ya existe una alerta activa para esta emergencia.'}); }
      const [result]=await c.execute('INSERT INTO alertas(id_usuario,id_sala,id_tipo_emergencia,id_estado_alerta,descripcion) VALUES(?,?,?,?,?)',[req.usuario.id_usuario,sala.id_sala,id_tipo_emergencia,estado.id_estado_alerta,descripcion.trim()||null]);
      // El trigger existente registra la creación, sin duplicar el historial.
      await c.commit(); res.status(201).json({id_alerta:result.insertId,mensaje:'Alerta registrada. Pendiente de atención por Enfermería.'});
    } catch(e) { if(c) await c.rollback().catch(()=>{}); next(e); } finally { c?.release(); }
  });
  router.post('/:id/estado', permitirRoles('Enfermería'), async (req,res,next) => {
    const id=Number(req.params.id), estado=req.body?.estado, comentario=req.body?.comentario||'';
    if(!Number.isSafeInteger(id)||id<1||!['En atención','Atendida'].includes(estado)||typeof comentario!=='string'||comentario.length>255) return res.status(400).json({mensaje:'Estado o comentario inválido.'});
    let c;
    try {
      c=await pool.getConnection(); await c.beginTransaction();
      const [[a]]=await c.execute('SELECT id_estado_alerta,atendida_por FROM alertas WHERE id_alerta=? FOR UPDATE',[id]);
      if(!a) {await c.rollback();return res.status(404).json({mensaje:'La alerta no existe.'});}
      const [[anterior]]=await c.execute('SELECT nombre FROM estados_alerta WHERE id_estado_alerta=?',[a.id_estado_alerta]);
      if((estado==='En atención'&&anterior?.nombre!=='Pendiente')||(estado==='Atendida'&&anterior?.nombre!=='En atención')||(a.atendida_por&&Number(a.atendida_por)!==Number(req.usuario.id_usuario))) {await c.rollback();return res.status(409).json({mensaje:'El estado cambió o la alerta está asignada a otra persona. Actualiza el panel.'});}
      const [[nuevo]]=await c.execute('SELECT id_estado_alerta FROM estados_alerta WHERE nombre=?',[estado]);
      if(!nuevo) throw new Error('Falta estado de alerta');
      await c.execute('UPDATE alertas SET id_estado_alerta=?,atendida_por=?,fecha_atencion=COALESCE(fecha_atencion,NOW()) WHERE id_alerta=?',[nuevo.id_estado_alerta,req.usuario.id_usuario,id]);
      await c.execute('INSERT INTO historial_alertas(id_alerta,id_estado_anterior,id_estado_nuevo,id_usuario,comentario) VALUES(?,?,?,?,?)',[id,a.id_estado_alerta,nuevo.id_estado_alerta,req.usuario.id_usuario,comentario.trim()||`Alerta ${estado.toLowerCase()}`]);
      await c.commit();res.json({mensaje:'Estado de alerta actualizado.'});
    }catch(e){if(c)await c.rollback().catch(()=>{});next(e);}finally{c?.release();}
  });
  return router;
}
module.exports={createEmergencias};
