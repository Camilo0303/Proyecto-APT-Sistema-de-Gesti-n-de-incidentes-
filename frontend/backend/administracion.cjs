const express = require('express');
const { permitirRoles } = require('./permisos.cjs');

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