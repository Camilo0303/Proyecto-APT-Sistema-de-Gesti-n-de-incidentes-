function invalido(mensaje) { const error = new Error(mensaje); error.status = 400; throw error; }
function texto(valor) {
  if (valor === undefined || valor === '') return '';
  if (typeof valor !== 'string') invalido('Formato de filtro inválido.');
  return valor;
}
function fecha(valor) {
  const v = texto(valor);
  if (!v) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1000-01-01') invalido('Fecha inválida.');
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) invalido('Fecha inválida.');
  return v;
}
function filtrarIncidencias(query, incluirEstado = true) {
  const condiciones = [], parametros = [];
  const desde = fecha(query.desde), hasta = fecha(query.hasta);
  if (desde && hasta && desde > hasta) invalido('La fecha desde no puede ser posterior a la fecha hasta.');
  if (desde) { condiciones.push('i.fecha_creacion >= ?'); parametros.push(`${desde} 00:00:00`); }
  if (hasta) { condiciones.push('i.fecha_creacion <= ?'); parametros.push(`${hasta} 23:59:59.999999`); }
  for (const [filtro, columna] of [['sala', 'id_sala'], ['categoria', 'id_categoria']]) {
    const v = texto(query[filtro]);
    if (!v) continue;
    if (!/^[1-9]\d{0,9}$/.test(v) || Number(v) > 2147483647) invalido('Sala o categoría inválida.');
    condiciones.push(`i.${columna} = ?`); parametros.push(Number(v));
  }
  if (incluirEstado) {
    const estado = texto(query.estado);
    if (estado && estado !== 'todas') {
      if (!['Pendiente', 'Asignada', 'En proceso', 'Resuelta', 'Cerrada', 'Anulada'].includes(estado)) invalido('Estado inválido.');
      condiciones.push('i.id_estado IN (SELECT id_estado FROM estados_incidencia WHERE nombre = ?)'); parametros.push(estado);
    }
  }
  return { condiciones, parametros, donde: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '' };
}
function ordenFecha(query) {
  const orden = texto(query.orden) || 'recientes';
  if (!['recientes', 'antiguas'].includes(orden)) invalido('Orden inválido.');
  return orden === 'antiguas' ? 'ASC' : 'DESC';
}
function leerPagina(query) {
  const pagina = Number(texto(query.pagina) || 1);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000) invalido('Página inválida.');
  return pagina;
}
async function catalogosFiltros(pool) {
  const [salas] = await pool.execute(`SELECT s.id_sala, CONCAT(COALESCE(e.nombre,''),' / Piso ',COALESCE(p.numero_piso,''),' / ',s.nombre,IF(s.activo=1,'',' (inactiva)')) AS nombre
    FROM salas s LEFT JOIN pisos p ON p.id_piso=s.id_piso LEFT JOIN edificios e ON e.id_edificio=p.id_edificio ORDER BY e.nombre,p.numero_piso,s.nombre`);
  const [categorias] = await pool.execute('SELECT id_categoria,nombre FROM categorias ORDER BY nombre');
  const [estados] = await pool.execute('SELECT id_estado,nombre FROM estados_incidencia ORDER BY id_estado');
  return { salas, categorias, estados };
}
module.exports = { filtrarIncidencias, ordenFecha, leerPagina, catalogosFiltros };
