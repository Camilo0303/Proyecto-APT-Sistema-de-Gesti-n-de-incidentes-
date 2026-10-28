import { useEffect, useState } from 'react';
import { api } from '../data/api';
import './FiltrosIncidencias.css';
const vacios = { desde: '', hasta: '', sala: '', categoria: '', estado: '', orden: 'recientes' };

export default function FiltrosIncidencias({ valor = {}, aplicar, incluirEstado = true, incluirOrden = true }) {
  const [form, setForm] = useState(() => ({ ...vacios, ...valor }));
  const [catalogos, setCatalogos] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true;
    api('/filtros-incidencias').then(r => { if (vigente) { setCatalogos(r); setError(''); } })
      .catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [recarga]);
  function enviar(valores) {
    const { desde, hasta, sala, categoria, estado, orden } = valores;
    if (desde && hasta && desde > hasta) { setError('La fecha desde debe ser anterior o igual a la fecha hasta.'); return; }
    setError(''); aplicar({ desde, hasta, sala, categoria, ...(incluirEstado ? { estado } : {}), ...(incluirOrden ? { orden } : {}) });
  }
  const cambiar = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  return <section className="sigi-filtros" aria-label="Filtros de incidencias">
    <h3>Filtrar incidencias</h3><p>Por fecha de creación. El rango incluye ambos días.</p>
    {error && <p className="sigi-filtros-error" role="alert">{error}</p>}
    {!catalogos ? <button type="button" onClick={() => setRecarga(n => n + 1)}>{error ? 'Reintentar filtros' : 'Cargando opciones…'}</button> : <form onSubmit={e => { e.preventDefault(); enviar(form); }}>
      <label>Desde<input type="date" name="desde" value={form.desde} max={form.hasta || undefined} onChange={cambiar} /></label>
      <label>Hasta<input type="date" name="hasta" value={form.hasta} min={form.desde || undefined} onChange={cambiar} /></label>
      <label>Sala<select name="sala" value={form.sala} onChange={cambiar}><option value="">Todas las salas</option>{catalogos.salas.map(s => <option key={s.id_sala} value={s.id_sala}>{s.nombre}</option>)}</select></label>
      <label>Categoría<select name="categoria" value={form.categoria} onChange={cambiar}><option value="">Todas las categorías</option>{catalogos.categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select></label>
      {incluirEstado && <label>Estado<select name="estado" value={form.estado} onChange={cambiar}><option value="">Todos los estados</option>{catalogos.estados.map(e => <option key={e.id_estado} value={e.nombre}>{e.nombre}</option>)}</select></label>}
      {incluirOrden && <label>Ordenar por fecha<select name="orden" value={form.orden} onChange={cambiar}><option value="recientes">Más recientes primero</option><option value="antiguas">Más antiguas primero</option></select></label>}
      <div className="sigi-filtros-acciones"><button type="submit">Aplicar filtros</button><button type="button" onClick={() => { setForm({ ...vacios }); enviar(vacios); }}>Limpiar filtros</button></div>
    </form>}
  </section>;
}
