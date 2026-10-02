const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, '.env'),
  quiet: true,
});

const express = require('express');
const mysql = require('mysql2/promise');

const { createAuth } = require('./auth.cjs');
const { createIncidencias } = require('./incidencias.cjs');
const { permitirRoles } = require('./permisos.cjs');
const { createAdministracion } = require('./administracion.cjs');
const { createCorreos } = require('./correos.cjs');

const app = express();
const port = Number(process.env.PORT || 3001);

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  connectTimeout: 10000,
  charset: 'utf8mb4',
});

const auth = createAuth(pool);

app.use('/api/auth', auth.router);
app.use(
  '/api/admin/correos',
  createCorreos(pool, auth.requireAuth)
);
app.use(
  '/api/admin',
  createAdministracion(pool, auth.requireAuth)
);

// Registro y consulta de reportes propios.
// Las funciones de gestión de Cetecom se agregarán después.
app.use(
  '/api/incidencias',
  auth.requireAuth,
  permitirRoles('Profesor', 'Administrador'),
  createIncidencias(pool, auth.requireAuth)
);

// Comprobación del acceso a cada panel.
const rolesPorPanel = {
  profesor: 'Profesor',
  cetecom: 'Técnico',
  administrador: 'Administrador',
  enfermeria: 'Enfermería',
};

app.get('/api/panel/:panel', auth.requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const rolNecesario = rolesPorPanel[req.params.panel];

  if (!rolNecesario) {
    return res.status(404).json({
      mensaje: 'El panel no existe.',
    });
  }

  if (req.usuario.rol !== rolNecesario) {
    return res.status(403).json({
      mensaje: 'No tienes permiso para acceder a este panel.',
    });
  }

  res.json({
    usuario: req.usuario,
    panel: req.params.panel,
  });
});

// El profesor consulta solo sus incidencias.
// El administrador puede consultar el resumen general.
app.get(
  '/api/dashboard',
  auth.requireAuth,
  permitirRoles('Profesor', 'Administrador'),
  async (req, res, next) => {
    res.set('Cache-Control', 'no-store');

    const esProfesor = req.usuario.rol === 'Profesor';

    const filtro = esProfesor
      ? 'WHERE id_usuario_creador = ?'
      : '';

    const parametros = esProfesor
      ? [req.usuario.id_usuario]
      : [];

    try {
      const [estadisticas] = await pool.execute(
        `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(estado = 'Pendiente'), 0) AS pendientes,
          COALESCE(SUM(estado = 'Asignada'), 0) AS asignadas,
          COALESCE(SUM(estado = 'En proceso'), 0) AS en_proceso,
          COALESCE(SUM(estado = 'Resuelta'), 0) AS resueltas,
          COALESCE(SUM(estado = 'Cerrada'), 0) AS cerradas
        FROM vista_incidencias_detalle
        ${filtro}
        `,
        parametros
      );

      const [ultimosReportes] = await pool.execute(
        `
        SELECT
          id_incidencia,
          titulo,
          sala,
          categoria,
          prioridad,
          estado,
          responsable,
          DATE_FORMAT(
            fecha_creacion, '%d/%m/%Y %H:%i'
          ) AS fecha
        FROM vista_incidencias_detalle
        ${filtro}
        ORDER BY fecha_creacion DESC, id_incidencia DESC
        LIMIT 10
        `,
        parametros
      );

      const resumen = Object.fromEntries(
        Object.entries(estadisticas[0]).map(
          ([clave, valor]) => [clave, Number(valor)]
        )
      );

      res.json({ resumen, ultimosReportes });
    } catch (error) {
      next(error);
    }
  }
);

app.use('/api', (_req, res) => {
  res.status(404).json({
    mensaje: 'La función solicitada no existe.',
  });
});

app.use((error, _req, res, _next) => {
  console.error(
    'Error en API:',
    error.code || error.type || error.message
  );

  const status =
    error.status === 400 || error.status === 413
      ? error.status
      : 500;

  res.status(status).json({
    mensaje:
      status === 500
        ? 'No se pudo completar la operación. Revisa la terminal del backend.'
        : 'Solicitud inválida.',
  });
});

async function iniciar() {
  try {
    if (process.env.DB_PASSWORD === 'TU_CONTRASEÑA_MYSQL') {
      throw new Error(
        'Completa DB_PASSWORD en frontend/backend/.env.'
      );
    }

    await pool.execute('SELECT 1');

    const server = app.listen(port, '127.0.0.1', () => {
      console.log('Conexión con MySQL correcta.');
      console.log(
        `Backend disponible en http://127.0.0.1:${port}`
      );
    });

    server.on('error', async error => {
      console.error(
        'No se pudo abrir el servidor:',
        error.code
      );
      auth.close();
      await pool.end();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(
      'No se pudo iniciar el backend:',
      error.code || error.message
    );
    auth.close();
    await pool.end();
    process.exitCode = 1;
  }
}

iniciar();