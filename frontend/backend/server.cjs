const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const mysql = require('mysql2/promise');
const { createAuth } = require('./auth.cjs');
const app = express();
const port = Number(process.env.PORT || 3001);
app.disable('x-powered-by');
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

app.use(express.json({ limit: '16kb' }));
const auth = createAuth(pool);
app.use('/api/auth', auth.router);

app.get('/api/dashboard', auth.requireAuth, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [estadisticas] = await pool.execute(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(e.nombre = 'Pendiente'), 0) AS pendientes,
        COALESCE(SUM(e.nombre = 'Asignada'), 0) AS asignadas,
        COALESCE(SUM(e.nombre = 'En proceso'), 0) AS en_proceso,
        COALESCE(SUM(e.nombre = 'Resuelta'), 0) AS resueltas,
        COALESCE(SUM(e.nombre = 'Cerrada'), 0) AS cerradas
      FROM incidencias i
      INNER JOIN estados_incidencia e ON e.id_estado = i.id_estado
    `);
    const [ultimosReportes] = await pool.execute(`
      SELECT i.id_incidencia, i.titulo, s.nombre AS sala,
        c.nombre AS categoria, p.nombre AS prioridad, e.nombre AS estado,
        COALESCE(CONCAT(u.nombre, ' ', u.apellido), 'Sin asignar') AS responsable,
        DATE_FORMAT(i.fecha_creacion, '%d/%m/%Y %H:%i') AS fecha
      FROM incidencias i
      INNER JOIN salas s ON s.id_sala = i.id_sala
      INNER JOIN categorias c ON c.id_categoria = i.id_categoria
      INNER JOIN prioridades p ON p.id_prioridad = i.id_prioridad
      INNER JOIN estados_incidencia e ON e.id_estado = i.id_estado
      LEFT JOIN usuarios u ON u.id_usuario = i.id_responsable
      ORDER BY i.fecha_creacion DESC, i.id_incidencia DESC LIMIT 10
    `);
    const resumen = Object.fromEntries(
      Object.entries(estadisticas[0]).map(([clave, valor]) => [clave, Number(valor)])
    );
    res.json({ resumen, ultimosReportes });
  } catch (error) {
    console.error('Error al consultar el dashboard:', error.code || error.message);
    res.status(500).json({ mensaje: 'No se pudieron obtener los datos del dashboard.' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Error en API:', error.code || error.type || error.message);
  const status = error.status === 400 || error.status === 413 ? error.status : 500;
  res.status(status).json({ mensaje: status === 500 ? 'No se pudo completar la operación. Revisa la conexión con MySQL.' : 'Solicitud inválida.' });
});

async function iniciar() {
  try {
    if (process.env.DB_PASSWORD === 'TU_CONTRASEÑA_MYSQL') {
      throw new Error('Completa DB_PASSWORD en frontend/backend/.env antes de iniciar.');
    }
    await pool.execute('SELECT 1');
    const server = app.listen(port, '127.0.0.1', () => {
      console.log('Conexión con MySQL correcta.');
      console.log(`Backend disponible en http://127.0.0.1:${port}`);
    });
    server.on('error', async (error) => {
      console.error('No se pudo abrir el servidor:', error.code);
      await pool.end();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('No se pudo iniciar el backend:', error.code || error.message);
    await pool.end();
    process.exitCode = 1;
  }
}
iniciar();
