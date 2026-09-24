const express = require('express');

function createIncidencias(pool, requireAuth) {
  const router = express.Router();

  router.use(requireAuth);

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Opciones del formulario.
  router.get('/catalogos', async (_req, res, next) => {
    try {
      const [categorias] = await pool.execute(
        'SELECT id_categoria, nombre FROM categorias ORDER BY nombre'
      );

      const [prioridades] = await pool.execute(
        'SELECT id_prioridad, nombre FROM prioridades ORDER BY id_prioridad'
      );

      const [salas] = await pool.execute(`
        SELECT
          s.id_sala,
          CONCAT(
            e.nombre, ' / ',
            COALESCE(p.nombre, CONCAT('Piso ', p.numero_piso)),
            ' / ', s.nombre
          ) AS nombre
        FROM salas s
        JOIN pisos p ON p.id_piso = s.id_piso
        JOIN edificios e ON e.id_edificio = p.id_edificio
        WHERE s.activo = 1
        ORDER BY e.nombre, p.numero_piso, s.nombre
      `);

      const [equipos] = await pool.execute(`
        SELECT
          q.id_equipo,
          q.id_sala,
          q.nombre,
          q.codigo_inventario
        FROM equipos q
        JOIN salas s ON s.id_sala = q.id_sala
        WHERE s.activo = 1
        ORDER BY q.nombre
      `);

      res.json({ categorias, prioridades, salas, equipos });
    } catch (error) {
      next(error);
    }
  });

  // Solo devuelve los reportes del usuario conectado.
  router.get('/mias', async (req, res, next) => {
    try {
      const [incidencias] = await pool.execute(
        `
        SELECT
          i.id_incidencia,
          i.titulo,
          i.descripcion,
          s.nombre AS sala,
          q.nombre AS equipo,
          c.nombre AS categoria,
          p.nombre AS prioridad,
          e.nombre AS estado,
          COALESCE(
            CONCAT(u.nombre, ' ', u.apellido),
            'Sin asignar'
          ) AS responsable,
          DATE_FORMAT(
            i.fecha_creacion, '%d/%m/%Y %H:%i'
          ) AS fecha
        FROM incidencias i
        JOIN salas s ON s.id_sala = i.id_sala
        JOIN categorias c ON c.id_categoria = i.id_categoria
        JOIN prioridades p ON p.id_prioridad = i.id_prioridad
        JOIN estados_incidencia e ON e.id_estado = i.id_estado
        LEFT JOIN equipos q ON q.id_equipo = i.id_equipo
        LEFT JOIN usuarios u ON u.id_usuario = i.id_responsable
        WHERE i.id_usuario_creador = ?
        ORDER BY i.fecha_creacion DESC, i.id_incidencia DESC
        LIMIT 100
        `,
        [req.usuario.id_usuario]
      );

      res.json({ incidencias });
    } catch (error) {
      next(error);
    }
  });

  // Crear una incidencia.
  router.post('/', async (req, res, next) => {
    if (
      !req.is('application/json') ||
      req.get('X-SIGI-Request') !== '1' ||
      req.get('Sec-Fetch-Site') === 'cross-site'
    ) {
      return res.status(403).json({
        mensaje: 'Solicitud no permitida.',
      });
    }

    const body = req.body || {};

    const titulo =
      typeof body.titulo === 'string'
        ? body.titulo.trim()
        : '';

    const descripcion =
      typeof body.descripcion === 'string'
        ? body.descripcion.trim()
        : '';

    function leerId(valor) {
      if (
        typeof valor !== 'number' &&
        typeof valor !== 'string'
      ) {
        return null;
      }

      const numero = Number(valor);

      return Number.isSafeInteger(numero) && numero > 0
        ? numero
        : null;
    }

    const sala = leerId(body.id_sala);
    const categoria = leerId(body.id_categoria);
    const prioridad = leerId(body.id_prioridad);

    const sinEquipo =
      body.id_equipo === null ||
      body.id_equipo === undefined ||
      body.id_equipo === '';

    const equipo = sinEquipo ? null : leerId(body.id_equipo);

    if (
      !titulo ||
      titulo.length > 150 ||
      descripcion.length > 2000 ||
      !sala ||
      !categoria ||
      !prioridad ||
      (!sinEquipo && !equipo)
    ) {
      return res.status(400).json({
        mensaje:
          'Completa título, sala, categoría y prioridad. ' +
          'El título admite hasta 150 caracteres y la descripción hasta 2000.',
      });
    }

    try {
      // Valida las referencias y guarda en una sola operación.
      // El creador viene de la sesión, no del navegador.
      const [result] = await pool.execute(
        `
        INSERT INTO incidencias (
          titulo,
          descripcion,
          id_usuario_creador,
          id_equipo,
          id_sala,
          id_categoria,
          id_prioridad,
          id_estado,
          id_responsable
        )
        SELECT
          ?, ?, ?, ?,
          s.id_sala,
          c.id_categoria,
          p.id_prioridad,
          e.id_estado,
          NULL
        FROM salas s
        JOIN categorias c ON c.id_categoria = ?
        JOIN prioridades p ON p.id_prioridad = ?
        JOIN estados_incidencia e ON e.nombre = 'Pendiente'
        WHERE s.id_sala = ?
          AND s.activo = 1
          AND (
            ? IS NULL
            OR EXISTS (
              SELECT 1
              FROM equipos q
              WHERE q.id_equipo = ?
                AND q.id_sala = s.id_sala
            )
          )
        `,
        [
          titulo,
          descripcion || null,
          req.usuario.id_usuario,
          equipo,
          categoria,
          prioridad,
          sala,
          equipo,
          equipo,
        ]
      );

      if (result.affectedRows !== 1) {
        return res.status(400).json({
          mensaje:
            'Revisa la sala, categoría, prioridad y equipo. ' +
            'El equipo debe pertenecer a la sala y debe existir el estado Pendiente.',
        });
      }

      // El trigger de MySQL ya registra la creación en el historial.
      res.status(201).json({
        mensaje: 'Incidencia registrada correctamente.',
        id_incidencia: result.insertId,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createIncidencias };