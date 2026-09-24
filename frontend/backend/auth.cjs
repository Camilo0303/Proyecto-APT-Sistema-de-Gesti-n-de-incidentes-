const express = require('express');
const { randomBytes } = require('node:crypto');
const {
  hashPassword,
  verifyPassword,
  PREFIX,
} = require('./passwords.cjs');

const USER_SQL = `
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
`;

const COOKIE = 'sigi_session';
const DURATION = 8 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

function cleanEmail(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function validEmail(email) {
  return (
    email.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function esCorreoProfesor(correo) {
  // Acepta @profesor.cl, @profesor.duoc.cl, etc.
  // Rechaza @gmail.com y @profesor falso sin un dominio válido.
  return /^[^\s@]+@profesor(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
    correo
  );
}

function tokenFrom(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE}=`));

  return cookie?.slice(COOKIE.length + 1);
}

function publicUser(row) {
  return {
    id_usuario: row.id_usuario,
    nombre: row.nombre,
    apellido: row.apellido,
    correo: row.correo,
    id_rol: row.id_rol,
    rol: row.rol,
  };
}

function createAuth(pool) {
  const router = express.Router();
  const sessions = new Map();
  const attempts = new Map();

  const cleanup = setInterval(() => {
    const ahora = Date.now();

    for (const [key, session] of sessions) {
      if (session.expires <= ahora) {
        sessions.delete(key);
      }
    }

    for (const [key, attempt] of attempts) {
      if (attempt.expires <= ahora) {
        attempts.delete(key);
      }
    }
  }, 60000);

  cleanup.unref();

  function newSession(req, res, id) {
    sessions.delete(tokenFrom(req));

    const token = randomBytes(32).toString('hex');

    sessions.set(token, {
      id,
      expires: Date.now() + DURATION,
    });

    res.cookie(COOKIE, token, {
      ...cookieOptions,
      maxAge: DURATION,
    });
  }

  async function requireAuth(req, res, next) {
    const token = tokenFrom(req);
    const session = sessions.get(token);

    if (!session || session.expires <= Date.now()) {
      sessions.delete(token);

      return res.status(401).json({
        mensaje: 'Inicia sesión para continuar.',
      });
    }

    try {
      const [rows] = await pool.execute(
        `${USER_SQL}
         WHERE u.id_usuario = ? AND u.activo = 1`,
        [session.id]
      );

      if (!rows.length) {
        sessions.delete(token);

        return res.status(401).json({
          mensaje: 'La cuenta no está disponible.',
        });
      }

      req.usuario = publicUser(rows[0]);
      next();
    } catch (error) {
      next(error);
    }
  }

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.use((req, res, next) => {
    if (req.method === 'POST') {
      if (
        !req.is('application/json') ||
        req.get('X-SIGI-Request') !== '1' ||
        req.get('Sec-Fetch-Site') === 'cross-site'
      ) {
        return res.status(403).json({
          mensaje: 'Solicitud no permitida.',
        });
      }

      if (
        req.path === '/login' ||
        req.path === '/registro'
      ) {
        const key = req.ip;
        let attempt = attempts.get(key);

        if (!attempt || attempt.expires <= Date.now()) {
          attempt = {
            count: 0,
            expires: Date.now() + 15 * 60 * 1000,
          };

          attempts.set(key, attempt);
        }

        attempt.count += 1;

        if (attempt.count > 30) {
          return res.status(429).json({
            mensaje:
              'Demasiados intentos. Intenta nuevamente en 15 minutos.',
          });
        }
      }
    }

    next();
  });

  // REGISTRO AUTOMÁTICO DE PROFESORES
  router.post('/registro', async (req, res, next) => {
    const { nombre, apellido, password } = req.body || {};
    const correo = cleanEmail(req.body?.correo);

    const nombresValidos = [nombre, apellido].every(
      value =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.trim().length <= 100
    );

    const passwordValida =
      typeof password === 'string' &&
      password.length >= 8 &&
      password.length <= 16;

    if (
      !nombresValidos ||
      !validEmail(correo) ||
      !passwordValida
    ) {
      return res.status(400).json({
        mensaje:
          'Completa nombre, apellido, correo válido y contraseña de 8 a 128 caracteres.',
      });
    }

    if (!esCorreoProfesor(correo)) {
      return res.status(403).json({
        mensaje:
          'Debes usar un correo de profesor, como nombre@profesor.cl o nombre@profesor.duoc.cl.',
      });
    }

    let connection;
    let transaccionActiva = false;

    try {
      const hash = await hashPassword(password);

      connection = await pool.getConnection();
      await connection.beginTransaction();
      transaccionActiva = true;

      // Asigna siempre el rol Profesor desde la base de datos.
      const [roles] = await connection.execute(
        'SELECT id_rol FROM roles WHERE nombre = ?',
        ['Profesor']
      );

      if (!roles.length) {
        await connection.rollback();
        transaccionActiva = false;

        return res.status(500).json({
          mensaje:
            'No existe el rol Profesor en la base de datos. Contacta al administrador.',
        });
      }

      // Guarda directamente en usuarios.
      // No consulta la tabla correos_autorizados.
      const [result] = await connection.execute(
        `INSERT INTO usuarios
          (nombre, apellido, correo, password, id_rol, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          nombre.trim(),
          apellido.trim(),
          correo,
          hash,
          roles[0].id_rol,
        ]
      );

      const [rows] = await connection.execute(
        `${USER_SQL} WHERE u.id_usuario = ?`,
        [result.insertId]
      );

      await connection.commit();
      transaccionActiva = false;

      newSession(req, res, result.insertId);

      return res.status(201).json({
        mensaje: 'Cuenta creada correctamente.',
        usuario: publicUser(rows[0]),
      });
    } catch (error) {
      if (connection && transaccionActiva) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          return next(rollbackError);
        }
      }

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          mensaje:
            'Este correo ya tiene una cuenta. Inicia sesión.',
        });
      }

      next(error);
    } finally {
      connection?.release();
    }
  });

  // INICIO DE SESIÓN
  router.post('/login', async (req, res, next) => {
    const correo = cleanEmail(req.body?.correo);
    const password = req.body?.password;

    if (
      !validEmail(correo) ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 128
    ) {
      return res.status(400).json({
        mensaje: 'Ingresa un correo y contraseña válidos.',
      });
    }

    try {
      const [rows] = await pool.execute(
        `SELECT id_usuario, password, activo
         FROM usuarios
         WHERE correo = ?`,
        [correo]
      );

      const account = rows[0];

      if (
        !account ||
        !account.activo ||
        !(await verifyPassword(password, account.password))
      ) {
        return res.status(401).json({
          mensaje:
            'Correo o contraseña incorrectos, o cuenta inactiva.',
        });
      }

      // Convierte las contraseñas antiguas del SQL inicial
      // a un hash después de un inicio de sesión correcto.
      if (!account.password.startsWith(PREFIX)) {
        const hash = await hashPassword(password);

        await pool.execute(
          `UPDATE usuarios
           SET password = ?
           WHERE id_usuario = ? AND BINARY password = ?`,
          [hash, account.id_usuario, account.password]
        );
      }

      const [users] = await pool.execute(
        `${USER_SQL}
         WHERE u.id_usuario = ? AND u.activo = 1`,
        [account.id_usuario]
      );

      if (!users.length) {
        return res.status(401).json({
          mensaje: 'La cuenta no está disponible.',
        });
      }

      newSession(req, res, account.id_usuario);

      return res.json({
        usuario: publicUser(users[0]),
      });
    } catch (error) {
      next(error);
    }
  });

  // CONSULTAR SESIÓN
  router.get('/me', requireAuth, (req, res) => {
    res.json({
      usuario: req.usuario,
    });
  });

  // CERRAR SESIÓN
  router.post('/logout', (req, res) => {
    sessions.delete(tokenFrom(req));
    res.clearCookie(COOKIE, cookieOptions);

    res.json({
      mensaje: 'Sesión cerrada.',
    });
  });

  return {
    router,
    requireAuth,
    close: () => clearInterval(cleanup),
  };
}

module.exports = { createAuth };