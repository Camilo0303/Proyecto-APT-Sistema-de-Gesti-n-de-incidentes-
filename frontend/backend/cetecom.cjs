const express = require('express');
const { permitirRoles } = require('./permisos.cjs');

function createCetecom(pool, requireAuth) {
  const router = express.Router();

  router.use(requireAuth);
  router.use(permitirRoles('Técnico'));

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Opciones reales de la base de datos.
  router.get('/catalogos', async (_req, res, next) => {
    try {
      const [prioridades] = await pool.execute(`
        SELECT id_prioridad, nombre
        FROM prioridades
        ORDER BY
          CASE nombre
            WHEN 'Crítica' THEN 1
            WHEN 'Alta' THEN 2
            WHEN 'Media' THEN 3
            WHEN 'Baja' THEN 4
            ELSE 5
          END,
          nombre
      `);

      const [estados] = await pool.execute(`
        SELECT id_estado, nombre
        FROM estados_incidencia
        ORDER BY id_estado
      `);

      res.json({ prioridades, estados });
    } catch (error) {
      next(error);
    }
  });

  // Consulta todos los registros mediante páginas de 20.
  router.get('/incidencias', async (req, res, next) => {
    const paginaSolicitada = Number(req.query.pagina || 1);
    const prioridad = String(req.query.prioridad || '');
    const estado = String(req.query.estado || 'activas');
    const buscar = String(req.query.buscar || '').trim();
    const orden = String(req.query.orden || 'prioridad');

    const estadosPermitidos = [
      'activas',
      'todas',
      'Pendiente',
      'Asignada',
      'En proceso',
      'Resuelta',
      'Cerrada',
      'Anulada',
    ];

    if (
      !Number.isSafeInteger(paginaSolicitada) ||
      paginaSolicitada < 1 ||
      buscar.length > 150 ||
      (prioridad && !/^[1-9]\d{0,8}$/.test(prioridad)) ||
      !estadosPermitidos.includes(estado) ||
      !['prioridad', 'recientes', 'antiguas'].includes(orden)
    ) {
      return res.status(400).json({
        mensaje: 'Revisa los filtros de búsqueda.',
      });
    }

    const condiciones = [];
    const parametros = [];

    if (estado === 'activas') {
      condiciones.push(
        "e.nombre IN ('Pendiente', 'Asignada', 'En proceso')"
      );
    } else if (estado !== 'todas') {
      condiciones.push('e.nombre = ?');
      parametros.push(estado);
    }

    if (prioridad) {
      condiciones.push('i.id_prioridad = ?');
      parametros.push(Number(prioridad));
    }

    if (buscar) {
      condiciones.push(`
        LOCATE(
          LOWER(?),
          LOWER(CONCAT_WS(
            ' ',
            CONCAT('INC-', LPAD(i.id_incidencia, 4, '0')),
            i.id_incidencia,
            i.titulo,
            i.descripcion,
            s.nombre,
            c.nombre,
            u.nombre,
            u.apellido
          ))
        ) > 0
      `);
      parametros.push(buscar);
    }

    const desde = `
      FROM incidencias i
      JOIN estados_incidencia e
        ON e.id_estado = i.id_estado
      JOIN prioridades p
        ON p.id_prioridad = i.id_prioridad
      JOIN categorias c
        ON c.id_categoria = i.id_categoria
      JOIN salas s
        ON s.id_sala = i.id_sala
      LEFT JOIN usuarios u
        ON u.id_usuario = i.id_responsable
    `;

    const donde = condiciones.length
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';

    const ordenes = {
      prioridad: `
        CASE p.nombre
          WHEN 'Crítica' THEN 1
          WHEN 'Alta' THEN 2
          WHEN 'Media' THEN 3
          WHEN 'Baja' THEN 4
          ELSE 5
        END,
        i.fecha_creacion ASC,
        i.id_incidencia ASC
      `,
      recientes: 'i.fecha_creacion DESC, i.id_incidencia DESC',
      antiguas: 'i.fecha_creacion ASC, i.id_incidencia ASC',
    };

    let conexion;

    try {
      conexion = await pool.getConnection();

      // Mantiene coherentes el contador y la página consultada.
      await conexion.query(
        'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'
      );
      await conexion.beginTransaction();

      const [[conteo]] = await conexion.execute(
        `SELECT COUNT(*) AS total ${desde} ${donde}`,
        parametros
      );

      const total = Number(conteo.total);
      const porPagina = 20;
      const paginas = Math.max(1, Math.ceil(total / porPagina));
      const pagina = Math.min(paginaSolicitada, paginas);
      const desplazamiento = (pagina - 1) * porPagina;

      const [incidencias] = await conexion.execute(
        `
        SELECT
          i.id_incidencia,
          i.titulo,
          i.descripcion,
          i.id_responsable,
          s.nombre AS sala,
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
        ${desde}
        ${donde}
        ORDER BY ${ordenes[orden]}
        LIMIT ${porPagina} OFFSET ${desplazamiento}
        `,
        parametros
      );

      const [[resumenRaw]] = await conexion.execute(`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(e.nombre = 'Pendiente'), 0) AS pendientes,
          COALESCE(
            SUM(e.nombre IN ('Asignada', 'En proceso')), 0
          ) AS en_atencion,
          COALESCE(
            SUM(e.nombre IN ('Resuelta', 'Cerrada')), 0
          ) AS finalizadas,
          COALESCE(SUM(e.nombre = 'Anulada'), 0) AS anuladas
        FROM incidencias i
        JOIN estados_incidencia e
          ON e.id_estado = i.id_estado
      `);

      await conexion.commit();

      const resumen = Object.fromEntries(
        Object.entries(resumenRaw).map(([clave, valor]) => [
          clave,
          Number(valor),
        ])
      );

      res.json({
        incidencias,
        resumen,
        total,
        pagina,
        paginas,
        porPagina,
      });
    } catch (error) {
      if (conexion) {
        await conexion.rollback().catch(() => {});
      }
      next(error);
    } finally {
      conexion?.release();
    }
  });

  // Atender, resolver o anular una incidencia.
  router.post('/incidencias/:id/accion', async (req, res, next) => {
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
    const accion = req.body?.accion;
    const comentario =
      typeof req.body?.comentario === 'string'
        ? req.body.comentario.trim()
        : '';

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !['atender', 'resolver', 'anular'].includes(accion) ||
      comentario.length > 255 ||
      (accion !== 'atender' && comentario.length < 5)
    ) {
      return res.status(400).json({
        mensaje:
          'Selecciona una acción válida. Para resolver o anular, ' +
          'escribe un comentario de entre 5 y 255 caracteres.',
      });
    }

    let conexion;

    try {
      conexion = await pool.getConnection();
      await conexion.beginTransaction();

      // Bloquea la fila para evitar que dos técnicos
      // tomen o cambien la misma incidencia simultáneamente.
      const [[incidencia]] = await conexion.execute(
        `
        SELECT id_incidencia, id_estado, id_responsable
        FROM incidencias
        WHERE id_incidencia = ?
        FOR UPDATE
        `,
        [id]
      );

      async function rechazar(status, mensaje) {
        await conexion.rollback();
        return res.status(status).json({ mensaje });
      }

      if (!incidencia) {
        return await rechazar(404, 'La incidencia no existe.');
      }

      const [[estadoActual]] = await conexion.execute(
        'SELECT nombre FROM estados_incidencia WHERE id_estado = ?',
        [incidencia.id_estado]
      );

      const nombreActual = estadoActual?.nombre;
      const tecnico = req.usuario.id_usuario;
      const responsable = incidencia.id_responsable;

      if (
        !['Pendiente', 'Asignada', 'En proceso'].includes(nombreActual)
      ) {
        return await rechazar(
          409,
          'La incidencia ya está finalizada o anulada. Actualiza el listado.'
        );
      }

      if (
        responsable !== null &&
        Number(responsable) !== Number(tecnico)
      ) {
        return await rechazar(
          409,
          'Esta incidencia está asignada a otro técnico.'
        );
      }

      if (
        accion === 'atender' &&
        !['Pendiente', 'Asignada'].includes(nombreActual)
      ) {
        return await rechazar(
          409,
          'La incidencia ya está en atención.'
        );
      }

      if (
        accion === 'resolver' &&
        (
          nombreActual !== 'En proceso' ||
          Number(responsable) !== Number(tecnico)
        )
      ) {
        return await rechazar(
          409,
          'Primero debes tomar la incidencia para atenderla.'
        );
      }

      const nuevosEstados = {
        atender: 'En proceso',
        resolver: 'Resuelta',
        anular: 'Anulada',
      };

      const [[nuevoEstado]] = await conexion.execute(
        `
        SELECT id_estado
        FROM estados_incidencia
        WHERE nombre = ?
        ORDER BY id_estado
        LIMIT 1
        `,
        [nuevosEstados[accion]]
      );

      if (!nuevoEstado) {
        return await rechazar(
          409,
          'Falta el estado requerido en la base de datos.'
        );
      }

      const nuevoResponsable =
        accion === 'atender' ? tecnico : responsable;

      // fecha_cierre se reserva para el estado Cerrada.
      // La fecha de resolución o anulación queda en el historial.
      await conexion.execute(
        `
        UPDATE incidencias
        SET id_estado = ?, id_responsable = ?
        WHERE id_incidencia = ?
        `,
        [nuevoEstado.id_estado, nuevoResponsable, id]
      );

      await conexion.execute(
        `
        INSERT INTO historial_incidencias (
          id_incidencia,
          tipo_movimiento,
          id_estado_anterior,
          id_estado_nuevo,
          id_usuario,
          id_responsable_asignado,
          comentario
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          {
            atender: 'ATENCION',
            resolver: 'RESOLUCION',
            anular: 'ANULACION',
          }[accion],
          incidencia.id_estado,
          nuevoEstado.id_estado,
          tecnico,
          nuevoResponsable,
          comentario || 'El técnico tomó la incidencia para atenderla.',
        ]
      );

      await conexion.commit();

      res.json({
        mensaje: {
          atender: 'La incidencia quedó en atención.',
          resolver: 'La incidencia quedó resuelta.',
          anular: 'La incidencia quedó anulada y conserva su historial.',
        }[accion],
      });
    } catch (error) {
      if (conexion) {
        await conexion.rollback().catch(() => {});
      }
      next(error);
    } finally {
      conexion?.release();
    }
  });

  return router;
}

module.exports = { createCetecom };