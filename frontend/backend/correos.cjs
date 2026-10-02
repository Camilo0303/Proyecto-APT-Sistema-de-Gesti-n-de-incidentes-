const express = require('express');
const { permitirRoles } = require('./permisos.cjs');

function createCorreos(pool, requireAuth) {
  const router = express.Router();

  router.use(requireAuth, permitirRoles('Administrador'));

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');

    if (
      req.method !== 'GET' &&
      (
        !req.is('application/json') ||
        req.get('X-SIGI-Request') !== '1' ||
        req.get('Sec-Fetch-Site') === 'cross-site'
      )
    ) {
      return res.status(403).json({
        mensaje: 'Solicitud no permitida.',
      });
    }

    next();
  });

  router.get('/', async (_req, res, next) => {
    try {
      const [roles] = await pool.execute(`
        SELECT id_rol, nombre
        FROM roles
        WHERE nombre IN (
          'Profesor', 'Técnico', 'Enfermería', 'Administrador'
        )
        ORDER BY nombre
      `);

      const [correos] = await pool.execute(`
        SELECT
          c.id_autorizacion,
          c.correo,
          c.id_rol,
          c.activo,
          r.nombre AS rol,
          u.id_usuario
        FROM correos_autorizados c
        JOIN roles r ON r.id_rol = c.id_rol
        LEFT JOIN usuarios u ON u.correo = c.correo
        ORDER BY c.fecha_creacion DESC, c.id_autorizacion DESC
      `);

      res.json({
        roles,
        correos: correos.map(correo => ({
          ...correo,
          activo: Number(correo.activo) === 1,
          registrado: correo.id_usuario !== null,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    const correo = typeof req.body?.correo === 'string'
      ? req.body.correo.trim().toLowerCase()
      : '';

    const idRol = Number(req.body?.id_rol);

    if (
      correo.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
      !Number.isSafeInteger(idRol) ||
      idRol <= 0
    ) {
      return res.status(400).json({
        mensaje: 'Ingresa un correo válido y selecciona un rol.',
      });
    }

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [roles] = await connection.execute(
        `SELECT id_rol
         FROM roles
         WHERE id_rol = ?
           AND nombre IN (
             'Profesor', 'Técnico', 'Enfermería', 'Administrador'
           )`,
        [idRol]
      );

      if (!roles.length) {
        await connection.rollback();

        return res.status(400).json({
          mensaje: 'El rol seleccionado no está habilitado.',
        });
      }

      await connection.execute(
        `INSERT INTO correos_autorizados (correo, id_rol, activo)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE id_rol = ?, activo = 1`,
        [correo, idRol, idRol]
      );

      const [usuarios] = await connection.execute(
        `SELECT id_usuario
         FROM usuarios
         WHERE correo = ?
         FOR UPDATE`,
        [correo]
      );

      if (usuarios.length) {
        await connection.rollback();

        return res.status(409).json({
          mensaje:
            'Ese correo ya tiene una cuenta. Esta sección no modifica usuarios registrados.',
        });
      }

      await connection.commit();

      res.json({
        mensaje:
          'Correo autorizado. La persona ya puede registrarse.',
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // El manejador general informará el error.
        }
      }

      next(error);
    } finally {
      connection?.release();
    }
  });

  router.patch('/:id/estado', async (req, res, next) => {
    const id = Number(req.params.id);
    const activo = req.body?.activo;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof activo !== 'boolean'
    ) {
      return res.status(400).json({
        mensaje: 'La autorización o el estado no son válidos.',
      });
    }

    let connection;

    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [filas] = await connection.execute(
        `SELECT correo
         FROM correos_autorizados
         WHERE id_autorizacion = ?
         FOR UPDATE`,
        [id]
      );

      if (!filas.length) {
        await connection.rollback();

        return res.status(404).json({
          mensaje: 'La autorización no existe.',
        });
      }

      const [usuarios] = await connection.execute(
        `SELECT id_usuario
         FROM usuarios
         WHERE correo = ?
         FOR UPDATE`,
        [filas[0].correo]
      );

      if (usuarios.length) {
        await connection.rollback();

        return res.status(409).json({
          mensaje:
            'La cuenta ya está registrada. Administra su acceso desde Usuarios registrados.',
        });
      }

      await connection.execute(
        `UPDATE correos_autorizados
         SET activo = ?
         WHERE id_autorizacion = ?`,
        [activo ? 1 : 0, id]
      );

      await connection.commit();

      res.json({
        mensaje: activo
          ? 'Autorización activada.'
          : 'Autorización revocada.',
      });
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch {
          // El manejador general informará el error.
        }
      }

      next(error);
    } finally {
      connection?.release();
    }
  });

  return router;
}

module.exports = { createCorreos };