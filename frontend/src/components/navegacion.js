const profesor = [
  ['Mi panel', '/profesor', '⌂'], ['Reportar incidencia', '/reportar', '+'],
  ['Escanear QR', '/escanear', '▦'], ['Mis reportes', '/historial', '☷'],
  ['Emergencia', '/panico', '!'],
];
const administrador = [
  ['Mi panel', '/administrador', '⌂'],
  ['Dashboard', '/administrador?seccion=dashboard', '▥'],
  ['Usuarios registrados', '/administrador?seccion=usuarios', '◎'],
  ['Correos autorizados', '/administrador?seccion=correos', '@'],
  ['Historial de incidencias', '/administrador?seccion=historial', '☷'],
  ['Salas y códigos QR', '/administrador?seccion=salas', '▦'],
];
const enfermeria = [
  ['Mi panel', '/enfermeria', '⌂'],
  ['Pendientes', '/enfermeria?seccion=pendientes', '!'],
  ['En atención', '/enfermeria?seccion=atencion', '+'],
  ['Atendidas recientes', '/enfermeria?seccion=historial', '☷'],
];
export function navegacionRol(rol) {
  const grupos = { Profesor: profesor, Administrador: administrador,
    Técnico: [['Gestión de incidencias', '/cetecom', '☷']], Enfermería: enfermeria };
  return (grupos[rol] || []).map(([nombre, destino, icono]) => ({ nombre, destino, icono }));
}
export function destinoActivo(destino, pathname, search) {
  const [ruta, consulta = ''] = destino.split('?');
  if (ruta !== pathname) return false;
  return (new URLSearchParams(consulta).get('seccion') || 'inicio') ===
    (new URLSearchParams(search).get('seccion') || 'inicio');
}
