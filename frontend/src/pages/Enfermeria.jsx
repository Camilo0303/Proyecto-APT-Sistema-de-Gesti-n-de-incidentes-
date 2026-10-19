import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { cerrarSesion, obtenerUsuario } from '../data/sesion';
import './Emergencias.css';
export default function Enfermeria(){
  const [datos,setDatos]=useState(null),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false),[recarga,setRecarga]=useState(0),[hora,setHora]=useState('');
  const usuario=obtenerUsuario();
  useEffect(()=>{
    let vigente=true,consultando=false;
    async function cargar(){if(consultando)return;consultando=true;try{const r=await api('/emergencias');if(vigente){setDatos(r);setError('');setHora(new Date().toLocaleTimeString());}}catch(e){if(vigente)setError(e.message);}finally{consultando=false;}}
    void cargar();const timer=setInterval(cargar,5000);
    const foco=()=>void cargar();window.addEventListener('focus',foco);
    return ()=>{vigente=false;clearInterval(timer);window.removeEventListener('focus',foco);};
  },[recarga]);
  async function cambiar(a,estado){if(ocupado)return;setOcupado(true);try{await api(`/emergencias/${a.id_alerta}/estado`,{estado});setRecarga(n=>n+1);}catch(e){setError(e.message);}finally{setOcupado(false);}}
  async function salir(){try{await cerrarSesion();window.location.replace('/login');}catch(e){setError(e.message);}}
  const pendientes=datos?.alertas.filter(a=>a.estado==='Pendiente').length||0;
  return <main className="emergencias"><header className="em-cabecera"><div><h1>Enfermería</h1><p>{usuario?.nombre} {usuario?.apellido}</p></div><button onClick={salir}>Cerrar sesión</button></header>
    <p>Alertas internas del establecimiento. Revisión automática cada 5 segundos mientras este panel está abierto.</p>
    <button onClick={()=>setRecarga(n=>n+1)}>Actualizar alertas</button>
    <p>Última consulta correcta: {hora||'Pendiente'}</p>
    {error&&<p role="alert" className="em-error">No se pudo actualizar: {error}. Los datos mostrados pueden estar desactualizados.</p>}
    <div aria-live="polite">{pendientes>0&&<div role="alert" className="em-urgente"><h2>{pendientes} alerta(s) urgente(s) pendiente(s)</h2><p>Revisa la ubicación y toma la atención.</p></div>}</div>
    {!datos?<p role="status">Cargando alertas...</p>:<><h2>Alertas activas ({datos.alertas.length})</h2>{!datos.alertas.length&&<p>No hay alertas activas en la última consulta.</p>}
      {datos.alertas.map(a=><article className={`em-tarjeta ${a.estado==='Pendiente'?'em-pendiente':''}`} key={a.id_alerta}>
        <h2>Alerta #{a.id_alerta} · {a.tipo}</h2><p><strong>{a.sala}</strong></p><p>Edificio {a.edificio} · Piso {a.piso}</p><p>{a.fecha} · Reporta: {a.profesor}</p><p>Estado: <strong>{a.estado}</strong></p>{a.descripcion&&<p>{a.descripcion}</p>}{a.responsable&&<p>Atiende: {a.responsable}</p>}
        {a.estado==='Pendiente'?<button disabled={ocupado} onClick={()=>cambiar(a,'En atención')}>Tomar atención</button>:Number(a.atendida_por)===Number(usuario?.id_usuario)&&<button disabled={ocupado} onClick={()=>cambiar(a,'Atendida')}>Marcar atendida</button>}
      </article>)}
      <h2>Últimas 20 alertas atendidas</h2>{datos.atendidas.map(a=><article className="em-tarjeta" key={a.id_alerta}><h3>#{a.id_alerta} · {a.sala}</h3><p>{a.tipo} · {a.fecha} · {a.responsable}</p></article>)}
    </>}
  </main>;
}
