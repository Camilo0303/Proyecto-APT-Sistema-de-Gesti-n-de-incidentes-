const express = require('express');
const { permitirRoles } = require('./permisos.cjs');

async function finalizarTurno(pool, id) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    await c.execute('SELECT id_usuario FROM usuarios WHERE id_usuario=? FOR UPDATE', [id]);
    await c.execute('UPDATE turnos_tecnicos SET fecha_fin=LEAST(NOW(),vence) WHERE id_usuario=? AND fecha_fin IS NULL', [id]);
    await c.commit();
  } catch (error) { await c.rollback().catch(() => {}); throw error; }
  finally { c.release(); }
}

function createTurnos(pool, requireAuth) {
  const router = express.Router();
  router.use(requireAuth, permitirRoles('Técnico'));
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  router.get('/', async (req,res,next) => {
    try {
      const [[turno]] = await pool.execute(`SELECT id_turno,
        DATE_FORMAT(fecha_inicio,'%Y-%m-%d %H:%i:%s') AS inicio,
        DATE_FORMAT(vence,'%Y-%m-%d %H:%i:%s') AS vence
        FROM turnos_tecnicos WHERE id_usuario=? AND fecha_fin IS NULL AND vence>NOW()
        ORDER BY id_turno DESC LIMIT 1`, [req.usuario.id_usuario]);
      res.json({ en_turno: Boolean(turno), turno: turno || null });
    } catch (error) { next(error); }
  });
  router.post('/', async (req,res,next) => {
    if (!req.is('application/json') || req.get('X-SIGI-Request') !== '1' || req.get('Sec-Fetch-Site') === 'cross-site') return res.status(403).json({mensaje:'Solicitud no permitida.'});
    if (typeof req.body?.en_turno !== 'boolean') return res.status(400).json({mensaje:'Selecciona un estado de turno válido.'});
    let c;
    try {
      c=await pool.getConnection(); await c.beginTransaction();
      const [[usuario]]=await c.execute(`SELECT u.id_usuario FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol
        WHERE u.id_usuario=? AND u.activo=1 AND r.nombre='Técnico' FOR UPDATE`,[req.usuario.id_usuario]);
      if (!usuario) { await c.rollback(); return res.status(403).json({mensaje:'La cuenta técnica no está habilitada.'}); }
      await c.execute('UPDATE turnos_tecnicos SET fecha_fin=vence WHERE id_usuario=? AND fecha_fin IS NULL AND vence<=NOW()',[usuario.id_usuario]);
      const [[actual]]=await c.execute('SELECT id_turno FROM turnos_tecnicos WHERE id_usuario=? AND fecha_fin IS NULL AND vence>NOW() LIMIT 1',[usuario.id_usuario]);
      if (req.body.en_turno && !actual) await c.execute('INSERT INTO turnos_tecnicos(id_usuario,vence) VALUES(?,DATE_ADD(NOW(),INTERVAL 8 HOUR))',[usuario.id_usuario]);
      if (!req.body.en_turno) await c.execute('UPDATE turnos_tecnicos SET fecha_fin=NOW() WHERE id_usuario=? AND fecha_fin IS NULL',[usuario.id_usuario]);
      await c.commit();
      res.json({en_turno:req.body.en_turno,mensaje:req.body.en_turno?'Turno iniciado.':'Turno finalizado.'});
    } catch (error) { if(c)await c.rollback().catch(()=>{}); next(error); }
    finally { c?.release(); }
  });
  return router;
}
module.exports={createTurnos,finalizarTurno};
