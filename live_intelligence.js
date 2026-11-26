(()=>{
  if(window.__NICE_LIVE_INTELLIGENCE)return;
  window.__NICE_LIVE_INTELLIGENCE=true;

  const CACHE_URL='protocolos/live-data.json';
  const API_URL=window.NICE_PORTAL_CONFIG?.API_URL;
  const REFRESH_MS=30000;
  const PUBLIC_LIMIT=500;
  const F=new Intl.NumberFormat('pt-BR');
  const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'});
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const yes=v=>/^(sim|s|yes|true|1)$/i.test(String(v??'').trim());
  const cleanUnit=v=>{
    const s=String(v??'').trim();
    if(!s||/^(sim|não|nao)$/i.test(s))return 'Não informado';
    return s;
  };
  const inferType=p=>{
    const s=norm([p.tipo,p.titulo].filter(Boolean).join(' '));
    if(s.includes('visita tecnica'))return 'Visita técnica';
    if(s.includes('palestra'))return 'Palestra';
    if(s.includes('pesquisa'))return 'Projeto de Pesquisa';
    if(s.includes('extens'))return 'Extensão extracurricular';
    if(s.includes('curso')||s.includes('capacit'))return 'Curso/Capacitação';
    if(s.includes('evento')||s.includes('semin')||s.includes('congress')||s.includes('jornada'))return 'Evento acadêmico/científico';
    return p.tipo||'Outros';
  };
  const inferReach=p=>p.alcance||p.reach||'Não identificado';
  const inferTheme=p=>p.tema||p.theme||'Não informado';
  const livePeople=p=>{const raw=String(p.responsavel||'').trim();if(!raw||/^(nao se aplica|não se aplica|sem responsavel|sem responsável)$/i.test(raw))return[];return raw.split(/\s+-\s+|[;\n\/]+/).map(x=>x.trim()).filter(Boolean).map(x=>'LIVE:'+norm(x));};
  const yearOf=p=>{
    const d=new Date(p.data_protocolo||p.data_inicio||'');
    return Number.isFinite(d.getTime())?d.getFullYear():new Date().getFullYear();
  };
  const numberOf=(p,...keys)=>{
    for(const k of keys){const n=Number(p[k]);if(Number.isFinite(n)&&n>=0)return n;}
    return 0;
  };
  const toProtocol=p=>({
    id:p.id,
    _live:true,
    year:yearOf(p),
    type:inferType(p),
    course:String(p.curso||'Não informado').trim()||'Não informado',
    mod:String(p.modalidade||'Não informado').trim()||'Não informado',
    unit:cleanUnit(p.unidade),
    reach:inferReach(p),
    theme:inferTheme(p),
    inf:numberOf(p,'participantes_informados'),
    part:numberOf(p,'participantes_consolidados','participantes_informados','publico_estimado'),
    stud:numberOf(p,'alunos_estimados'),
    est:!numberOf(p,'participantes_informados','participantes_consolidados')&&!!numberOf(p,'publico_estimado'),
    ext:/extens/i.test(String(p.tipo||p.titulo||'')),
    partner:yes(p.parceria||p.parceiro),
    cert:yes(p.certificados||p.certificado),
    lab:yes(p.auditorio)||yes(p.laboratorio),
    veh:yes(p.veiculo),
    ods:String(p.ods||'').trim(),
    people:livePeople(p)
  });
  const toReport=p=>({...p,id:'REL-'+p.id});
  const state=document.getElementById('nice-sync-state');
  const source=document.getElementById('nice-source');
  const refresh=document.getElementById('nice-refresh');
  let inFlight=false, lastAttempt=0, appliedAt=0, signature='';

  async function getJSON(url) {
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw new Error('Fonte indisponível');
    return response.json();
  }

  function projectsOf(payload) {
    const rows=payload?.projects;
    if(payload?.ok!==true || !Array.isArray(rows) || payload.total!==rows.length ||
       rows.some(row=>!row || !/^NICE-\d{4}-\d{5}$/.test(row.id) || typeof row.status!=='string') ||
       new Set(rows.map(row=>row.id)).size!==rows.length) {
      throw new Error('Resposta operacional inválida');
    }
    return rows;
  }

  function apply(projects, timestamp, mode) {
    const protocols=projects.map(toProtocol);
    const reports=protocols.filter((_,i)=>projects[i].status==='FINALIZADO').map(toReport);
    const nextSignature=JSON.stringify([protocols,reports]);
    if(nextSignature!==signature) {
      const P=window.__NICE_PROTOCOLS, R=window.__NICE_REPORTS;
      P.splice(0,P.length,...P.filter(p=>!p._live),...protocols);
      R.splice(0,R.length,...R.filter(r=>!r._live),...reports);
      signature=nextSignature;
      window.dispatchEvent(new Event('nice:projects-updated'));
    }
    appliedAt=timestamp;
    const bounded=projects.length===PUBLIC_LIMIT;
    const open=projects.filter(p=>!['FINALIZADO','CANCELADO'].includes(p.status)).length;
    for(const [field, value] of [['total',projects.length],['closed',reports.length],['open',open]]) {
      document.getElementById('nice-ops-'+field).textContent=F.format(value);
    }
    source.textContent=bounded?'Exibindo somente os 500 protocolos mais recentes':
      mode==='live'?'Consulta direta · a cada 30 s':'Usando a última cópia publicada';
    state.dataset.state=mode;
    state.textContent=(mode==='live'?'Consulta ao vivo · ':'Cópia publicada · ')+clock.format(timestamp);
  }

  async function sync(manual=false) {
    if(inFlight || (!manual && document.hidden)) return;
    inFlight=true;
    lastAttempt=Date.now();
    refresh.disabled=true;
    try {
      const url=new URL(API_URL);
      url.search=new URLSearchParams({action:'projects',limit:PUBLIC_LIMIT,_:lastAttempt});
      apply(projectsOf(await getJSON(url)),Date.now(),'live');
    } catch(directError) {
      try {
        const data=await getJSON(CACHE_URL+'?ts='+Date.now());
        const time=Date.parse(data?.synced_at);
        if(data?.ok!==true || !Number.isFinite(time) || time<appliedAt) throw directError;
        apply(projectsOf(data.projects),time,'cache');
      } catch {
        state.dataset.state='stale';
        state.textContent=appliedAt?'Última atualização · '+clock.format(appliedAt):'Consulta operacional indisponível';
        source.textContent=appliedAt?'Conexão indisponível · exibindo os últimos dados obtidos':
          'Controle indisponível · histórico disponível abaixo';
      }
    } finally {
      refresh.disabled=false;
      inFlight=false;
    }
  }

  refresh.addEventListener('click',()=>sync(true));
  document.addEventListener('visibilitychange',()=>{
    if(Date.now()-lastAttempt>=REFRESH_MS) sync();
  });
  window.addEventListener('online',()=>sync());
  sync();
  setInterval(sync,REFRESH_MS);
})();
