import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../data/api';
import './Emergencias.css';
export default function Panico() {
  const [params] = useSearchParams();
  const codigo = params.get('qr') || '';
  const [sala,setSala]=useState(null), [tipos,setTipos]=useState([]), [tipo,setTipo]=useState('');
  const [descripcion,setDescripcion]=useState(''), [confirmado,setConfirmado]=useState(false);
  const [error,setError]=useState(''), [enviando,setEnviando]=useState(false), [resultado,setResultado]=useState(null);
  const [mias,setMias]=useState([]), [errorEstado,setErrorEstado]=useState('');
  useEffect(()=>{
    let vigente=true;
    Promise.all([api('/emergencias/catalogos'),codigo?api(`/incidencias/sala-qr?codigo=${encodeURIComponent(codigo)}`):Promise.resolve(null)])
      .then(([c,s])=>{if(vigente){setTipos(c.tipos);setSala(s?.sala||null);}})
      .catch(e=>{if(vigente)setError(e.message);});
    return ()=>{vigente=false;};
  },[codigo]);
  useEffect(()=>{
    if(!resultado)return;
    let vigente=true,ocupado=false;
    async function consultar(){if(ocupado)return;ocupado=true;try{const r=await api('/emergencias/mias');if(vigente){setMias(r.alertas);setErrorEstado('');}}catch(e){if(vigente)setErrorEstado(e.message);}finally{ocupado=false;}}
    void consultar();const timer=setInterval(consultar,5000);
    return ()=>{vigente=false;clearInterval(timer);};
  },[resultado]);
  async function enviar(e){e.preventDefault();if(enviando||!sala||!confirmado)return;setEnviando(true);setError('');try{setResultado(await api('/emergencias',{codigo_qr:codigo,id_tipo_emergencia:Number(tipo),descripcion}));}catch(err){setError(err.message);}finally{setEnviando(false);}}
  const seguimiento=mias.find(a=>a.id_alerta===resultado?.id_alerta);
  return <main className="emergencias"><h1>Alerta de emergencia interna</h1>
    <p>Esta alerta se muestra en el panel de Enfermería. No contacta servicios externos ni reemplaza los protocolos de emergencia de la institución.</p>
    {error&&<p role="alert" className="em-error">{error}</p>}
    {resultado?<section className="em-tarjeta"><h2>Alerta #{resultado.id_alerta} registrada</h2><p>{resultado.mensaje}</p><p>Estado: <strong>{seguimiento?.estado||'Consultando...'}</strong></p>{seguimiento?.responsable&&<p>Atiende: {seguimiento.responsable}</p>}{errorEstado&&<p role="alert">No se pudo actualizar el estado: {errorEstado}</p>}<p>El registro no confirma por sí solo que Enfermería lo haya visto.</p></section>:<form onSubmit={enviar}>
      <Link to="/escanear?destino=emergencia">{sala?'Escanear otra sala':'Identificar sala con QR'}</Link>
      {sala&&<section className="em-tarjeta"><h2>{sala.nombre}</h2><p>Edificio {sala.edificio} · Piso {sala.piso}</p><p>Confirma que esta es la ubicación de la emergencia.</p></section>}
      <label>Tipo de emergencia<select required value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Selecciona el tipo</option>{tipos.map(t=><option key={t.id_tipo_emergencia} value={t.id_tipo_emergencia}>{t.nombre}</option>)}</select></label>
      <label>Descripción opcional<textarea maxLength={255} value={descripcion} onChange={e=>setDescripcion(e.target.value)}/></label>
      <label><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/> Confirmo una emergencia real en esta sala.</label>
      <button className="em-urgente" disabled={!sala||!confirmado||!tipo||enviando}>{enviando?'Registrando...':'Confirmar y enviar alerta a Enfermería'}</button>
    </form>}
    <p><Link to="/profesor">Volver al inicio</Link></p>
  </main>;
}
