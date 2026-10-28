const express = require('express');
const { permitirRoles } = require('./permisos.cjs');
const { filtrarIncidencias, ordenFecha, leerPagina } = require('./filtros-incidencias.cjs');

function createAdministracion(pool, requireAuth) {
  const router = express.Router();

  router.use(requireAuth, permitirRoles('Administrador'));

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/usuarios', async (_req, res, next) => {
    try {
      const [usuarios] = await pool.execute(`
        SELECT
          u.id_usuario,
          u.nombre,
          u.apellido,
          u.correo,
          u.id_rol,
          u.activo,
          r.nombre AS rol
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        ORDER BY u.nombre, u.apellido, u.id_usuario
      `);

      res.json({
        usuarios: usuarios.map(usuario => ({
          ...usuario,
          activo: Number(usuario.activo) === 1,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/salas-qr', async (_req, res, next) => {
    try {
      const [salas] = await pool.execute(`
        SELECT s.id_sala, s.nombre, s.codigo_sala, s.codigo_qr,
               e.nombre AS edificio, p.numero_piso AS piso
        FROM salas s
        JOIN pisos p ON p.id_piso = s.id_piso
        JOIN edificios e ON e.id_edificio = p.id_edificio
        WHERE s.activo = 1
        ORDER BY e.nombre, p.numero_piso, s.codigo_sala, s.id_sala
      `);
      res.json({ salas });
    } catch (error) { next(error); }
  });

  router.get('/incidencias', async (req, res, next) => {
    try {
      const pagina = leerPagina(req.query);
      const filtros = filtrarIncidencias(req.query);
      const orden = ordenFecha(req.query);
      const [[conteo]] = await pool.execute(`SELECT COUNT(*) AS total FROM incidencias i ${filtros.donde}`, filtros.parametros);
      const total = Number(conteo.total);
      const paginas = Math.max(1, Math.ceil(total / 20));
      const actual = Math.min(pagina, paginas);
      const [incidencias] = await pool.execute(`
        SELECT i.id_incidencia, i.titulo, i.descripcion,
          DATE_FORMAT(i.fecha_creacion, '%d/%m/%Y %H:%i:%s') AS fecha,
          s.nombre AS sala, c.nombre AS categoria, p.nombre AS prioridad,
          e.nombre AS estado,
          CONCAT(creador.nombre, ' ', creador.apellido) AS creador,
          COALESCE(CONCAT(u.nombre, ' ', u.apellido), 'Sin asignar') AS responsable
        FROM incidencias i
        LEFT JOIN salas s ON s.id_sala = i.id_sala
        LEFT JOIN categorias c ON c.id_categoria = i.id_categoria
        LEFT JOIN prioridades p ON p.id_prioridad = i.id_prioridad
        LEFT JOIN estados_incidencia e ON e.id_estado = i.id_estado
        LEFT JOIN usuarios creador ON creador.id_usuario = i.id_usuario_creador
        LEFT JOIN usuarios u ON u.id_usuario = i.id_responsable
        ${filtros.donde}
        ORDER BY i.fecha_creacion ${orden}, i.id_incidencia ${orden}
        LIMIT 20 OFFSET ${(actual - 1) * 20}
      `, filtros.parametros);
      res.json({ incidencias, total, pagina: actual, paginas });
    } catch (error) { next(error); }
  });

  router.get('/incidencias/:id/historial', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ mensaje: 'Incidencia inválida.' });
    }
    try {
      const [[incidencia]] = await pool.execute(
        'SELECT id_incidencia, titulo, descripcion FROM incidencias WHERE id_incidencia = ?', [id]
      );
      if (!incidencia) return res.status(404).json({ mensaje: 'La incidencia no existe.' });
      const [historial] = await pool.execute(`
        SELECT h.id_historial, h.tipo_movimiento, h.comentario,
          DATE_FORMAT(h.fecha_cambio, '%d/%m/%Y %H:%i:%s') AS fecha,
          anterior.nombre AS estado_anterior, nuevo.nombre AS estado_nuevo,
          CONCAT(u.nombre, ' ', u.apellido) AS realizado_por,
          CONCAT(r.nombre, ' ', r.apellido) AS responsable_asignado
        FROM historial_incidencias h
        LEFT JOIN estados_incidencia anterior ON anterior.id_estado = h.id_estado_anterior
        LEFT JOIN estados_incidencia nuevo ON nuevo.id_estado = h.id_estado_nuevo
        LEFT JOIN usuarios u ON u.id_usuario = h.id_usuario
        LEFT JOIN usuarios r ON r.id_usuario = h.id_responsable_asignado
        WHERE h.id_incidencia = ?
        ORDER BY h.fecha_cambio ASC, h.id_historial ASC
      `, [id]);
      res.json({ incidencia, historial });
    } catch (error) { next(error); }
  });

  router.patch('/usuarios/:id/estado', async (req, res, next) => {
    if (
      !req.is('application/json') ||
      req.get('X-SIGI-Request') !== '1' ||
      req.get('Sec-Fetch-Site') === 'cross-site'
    ) {
      return res.status(403).json({
        mensaje: 'Solicitud no permitida.',
      });
    }

    const id = Number(req.params.id);
    const activo = req.body?.activo;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof activo !== 'boolean'
    ) {
      return res.status(400).json({
        mensaje: 'Selecciona un usuario y un estado válidos.',
      });
    }

    if (id === req.usuario.id_usuario) {
      return res.status(403).json({
        mensaje: 'No puedes modificar el estado de tu propia cuenta.',
      });
    }

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [usuarios] = await connection.execute(
        `SELECT u.id_usuario, r.nombre AS rol
         FROM usuarios u
         JOIN roles r ON r.id_rol = u.id_rol
         WHERE u.id_usuario = ?
         FOR UPDATE`,
        [id]
      );

      if (!usuarios.length) {
        await connection.rollback();

        return res.status(404).json({
          mensaje: 'El usuario no existe.',
        });
      }

      if (usuarios[0].rol === 'Administrador') {
        await connection.rollback();

        return res.status(403).json({
          mensaje: 'Las cuentas de administrador están protegidas.',
        });
      }

      await connection.execute(
        'UPDATE usuarios SET activo = ? WHERE id_usuario = ?',
        [activo ? 1 : 0, id]
      );

      await connection.commit();

      res.json({
        mensaje: activo
          ? 'Cuenta activada correctamente.'
          : 'Cuenta desactivada correctamente.',
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // El manejador general informará el fallo.
        }
      }

      next(error);
    } finally {
      connection?.release();
    }
  });

  return router;
}

module.exports = { createAdministracion };
