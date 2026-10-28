const { filtrarIncidencias } = require('./filtros-incidencias.cjs');

const joins = `FROM incidencias i
  LEFT JOIN salas s ON s.id_sala=i.id_sala
  LEFT JOIN pisos piso ON piso.id_piso=s.id_piso
  LEFT JOIN edificios edificio ON edificio.id_edificio=piso.id_edificio
  LEFT JOIN categorias c ON c.id_categoria=i.id_categoria
  LEFT JOIN estados_incidencia e ON e.id_estado=i.id_estado
  LEFT JOIN prioridades p ON p.id_prioridad=i.id_prioridad
  LEFT JOIN usuarios creador ON creador.id_usuario=i.id_usuario_creador
  LEFT JOIN usuarios responsable ON responsable.id_usuario=i.id_responsable`;
const duracion = `CASE WHEN e.nombre IN ('Resuelta','Cerrada') AND i.fecha_cierre >= i.fecha_creacion
  THEN TIMESTAMPDIFF(SECOND,i.fecha_creacion,i.fecha_cierre)/3600.0 END`;

async function instantanea(pool, trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await conexion.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally { conexion.release(); }
}

async function consultarDashboard(pool, query) {
  const f = filtrarIncidencias(query);
  return instantanea(pool, async conexion => {
    const consultar = async sql => (await conexion.execute(sql, f.parametros))[0];
    const [resumen] = await consultar(`SELECT COUNT(*) AS total,
      COALESCE(SUM(e.nombre='Pendiente'),0) AS pendientes,
      COALESCE(SUM(e.nombre='Asignada'),0) AS asignadas,
      COALESCE(SUM(e.nombre='En proceso'),0) AS en_proceso,
      COALESCE(SUM(e.nombre='Resuelta'),0) AS resueltas,
      COALESCE(SUM(e.nombre='Cerrada'),0) AS cerradas,
      COALESCE(SUM(e.nombre='Anulada'),0) AS anuladas,
      ROUND(AVG(${duracion}),1) AS horas_resolucion,
      COUNT(${duracion}) AS muestra_resolucion
      ${joins} ${f.donde}`);
    const meses = await consultar(`SELECT DATE_FORMAT(i.fecha_creacion,'%Y-%m') AS mes, COUNT(*) AS total
      FROM incidencias i ${f.donde} GROUP BY mes ORDER BY mes`);
    const salas = await consultar(`SELECT i.id_sala, CONCAT(COALESCE(edificio.nombre,'Sin edificio'),
      ' / Piso ',COALESCE(piso.numero_piso,'—'),' / ',COALESCE(s.nombre,'Sin sala')) AS nombre, COUNT(*) AS total
      ${joins} ${f.donde} GROUP BY i.id_sala,edificio.nombre,piso.numero_piso,s.nombre
      ORDER BY total DESC,i.id_sala LIMIT 10`);
    const categorias = await consultar(`SELECT i.id_categoria, COALESCE(c.nombre,'Sin categoría') AS nombre, COUNT(*) AS total
      ${joins} ${f.donde} GROUP BY i.id_categoria,c.nombre ORDER BY total DESC,i.id_categoria`);
    const tecnicos = await consultar(`SELECT i.id_responsable,
      COALESCE(CONCAT(responsable.nombre,' ',responsable.apellido),'Sin asignar') AS nombre,
      COUNT(*) AS total, SUM(e.nombre IN ('Pendiente','Asignada','En proceso')) AS abiertas,
      SUM(e.nombre IN ('Resuelta','Cerrada')) AS finalizadas
      ${joins} ${f.donde} GROUP BY i.id_responsable,responsable.nombre,responsable.apellido
      ORDER BY total DESC,i.id_responsable`);
    const profesores = await consultar(`SELECT i.id_usuario_creador,
      CONCAT(creador.nombre,' ',creador.apellido) AS nombre, COUNT(*) AS total
      ${joins} ${f.donde ? f.donde + ' AND' : 'WHERE'}
      creador.id_rol IN (SELECT id_rol FROM roles WHERE nombre='Profesor')
      GROUP BY i.id_usuario_creador,creador.nombre,creador.apellido
      ORDER BY total DESC,i.id_usuario_creador LIMIT 10`);
    const recientes = await consultar(`SELECT i.id_incidencia,i.titulo,s.nombre AS sala,c.nombre AS categoria,
      e.nombre AS estado,DATE_FORMAT(i.fecha_creacion,'%Y-%m-%d %H:%i:%s') AS fecha
      ${joins} ${f.donde} ORDER BY i.fecha_creacion DESC,i.id_incidencia DESC LIMIT 10`);
    return { resumen, meses, salas, categorias, tecnicos, profesores, recientes, actualizado: new Date().toISOString() };
  });
}

// Se conservan los tipos numéricos; los textos se escapan también para hojas de cálculo.
function celdaCSV(valor) {
  if (valor === null || valor === undefined) return '""';
  let texto = String(valor);
  if (typeof valor === 'string' && /^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replace(/"/g, '""') + '"';
}
const columnas = ['id_incidencia','titulo','fecha_creacion','fecha_cierre','id_sala','codigo_sala','sala',
  'edificio','piso','id_categoria','categoria','prioridad','estado','id_usuario_creador','creador',
  'id_responsable','responsable','horas_resolucion'];

async function exportarDashboard(pool, query, res) {
  const f = filtrarIncidencias(query);
  await instantanea(pool, async conexion => {
    let cursor = 0;
    let cabecera = false;
    while (!res.destroyed) {
      const [filas] = await conexion.execute(`SELECT i.id_incidencia,i.titulo,
        DATE_FORMAT(i.fecha_creacion,'%Y-%m-%d %H:%i:%s') AS fecha_creacion,
        DATE_FORMAT(i.fecha_cierre,'%Y-%m-%d %H:%i:%s') AS fecha_cierre,
        i.id_sala,s.codigo_sala,s.nombre AS sala,edificio.nombre AS edificio,piso.numero_piso AS piso,
        i.id_categoria,c.nombre AS categoria,p.nombre AS prioridad,e.nombre AS estado,
        i.id_usuario_creador,CONCAT(creador.nombre,' ',creador.apellido) AS creador,
        i.id_responsable,CONCAT(responsable.nombre,' ',responsable.apellido) AS responsable,
        ROUND(${duracion},2) AS horas_resolucion
        ${joins} ${f.donde ? f.donde + ' AND' : 'WHERE'} i.id_incidencia > ?
        ORDER BY i.id_incidencia LIMIT 1000`, [...f.parametros, cursor]);
      if (!cabecera) {
        res.type('text/csv; charset=utf-8');
        res.attachment(`sigi-incidencias-${new Date().toISOString().slice(0,10)}.csv`);
        res.write('\uFEFF' + columnas.join(',') + '\r\n');
        cabecera = true;
      }
      if (!filas.length) break;
      const bloque = filas.map(fila => columnas.map(c => celdaCSV(fila[c])).join(',')).join('\r\n') + '\r\n';
      if (!res.write(bloque)) {
        await new Promise(resolve => {
          const terminar = () => { res.off('drain', terminar); res.off('close', terminar); resolve(); };
          res.once('drain', terminar); res.once('close', terminar);
          if (res.destroyed) terminar();
        });
      }
      cursor = filas.at(-1).id_incidencia;
    }
  });
  res.end();
}

module.exports = { consultarDashboard, exportarDashboard, celdaCSV };
