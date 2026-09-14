(()=>{
  if(window.__NICE_LIVE_INTELLIGENCE)return;
  window.__NICE_LIVE_INTELLIGENCE=true;

  const CACHE_URL='protocolos/live-data.json';
  const REFRESH_MS=60000;
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
    inf:numberOf(p,'participantes_informados','participantes','publico_estimado'),
    part:numberOf(p,'participantes','participantes_informados','publico_estimado'),
    stud:numberOf(p,'alunos_estimados','alunos','estudantes'),
    est:!numberOf(p,'participantes_informados','participantes'),
    ext:/extens/i.test(String(p.tipo||p.titulo||'')),
    partner:yes(p.parceria||p.parceiro),
    cert:yes(p.certificados||p.certificado),
    lab:yes(p.auditorio)||yes(p.laboratorio),
    veh:yes(p.veiculo),
    people:[]
  });
  const toReport=p=>({id:'REL-'+p.id,_live:true,year:yearOf(p),type:inferType(p),course:String(p.curso||'Não informado').trim()||'Não informado'});

  function addOption(id,value){
    if(!value||value==='Não informado'||value==='Não identificado')return;
    const s=document.getElementById(id);if(!s)return;
    if([...s.options].some(o=>o.value===String(value)))return;
    const o=document.createElement('option');o.value=String(value);o.textContent=String(value);s.appendChild(o);
  }

  function fire(id){
    const el=document.getElementById(id);if(!el)return;
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function statusBadge(data){
    const el=document.querySelector('.top .status');if(!el)return;
    const dt=new Date(data.synced_at||Date.now());
    const stamp=Number.isFinite(dt.getTime())?dt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'';
    el.textContent=stamp?'Dados atualizados em '+stamp:'Dados em atualização automática';
    el.title='Base histórica consolidada + protocolos atuais sincronizados automaticamente';
  }

  function note(data,count){
    let n=document.getElementById('nice-live-note');
    if(!n){
      n=document.createElement('div');n.id='nice-live-note';
      n.style='max-width:1400px;margin:10px auto 0;padding:8px 14px;border:1px solid #cfe0ee;background:#f7fbfe;color:#476177;border-radius:10px;font:12px Segoe UI,Arial,sans-serif;text-align:center';
      const nav=document.querySelector('.tabs');nav?.insertAdjacentElement('afterend',n);
    }
    n.textContent=`Base integrada automaticamente: histórico consolidado + ${count} protocolo${count===1?'':'s'} do sistema atual. Sincronização operacional pelo GitHub.`;
  }

  async function sync(){
    try{
      if(!Array.isArray(window.__NICE_PROTOCOLS)||!Array.isArray(window.__NICE_REPORTS))return;
      const r=await fetch(CACHE_URL+'?ts='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw new Error('cache indisponível');
      const data=await r.json();
      const projects=Array.isArray(data?.projects?.projects)?data.projects.projects:[];
      const P=window.__NICE_PROTOCOLS,R=window.__NICE_REPORTS;
      for(let i=P.length-1;i>=0;i--)if(P[i]?._live)P.splice(i,1);
      for(let i=R.length-1;i>=0;i--)if(R[i]?._live)R.splice(i,1);
      projects.forEach(p=>{
        const x=toProtocol(p);P.push(x);
        addOption('fy',x.year);addOption('fc',x.course);addOption('ft',x.type);addOption('fm',x.mod);addOption('fu',x.unit);addOption('fr',x.reach);addOption('iy',x.year);
        if(String(p.status||'').toUpperCase()==='FINALIZADO')R.push(toReport(p));
      });
      statusBadge(data);note(data,projects.length);
      fire('fy');fire('iy');
      window.dispatchEvent(new Event('resize'));
      console.info('NICE: inteligência atualizada com',projects.length,'protocolos atuais.');
    }catch(err){console.warn('NICE: integração ao vivo indisponível',err);}
  }

  let tries=0;
  const wait=()=>{
    if(Array.isArray(window.__NICE_PROTOCOLS)&&Array.isArray(window.__NICE_REPORTS)){sync();setInterval(sync,REFRESH_MS);return;}
    if(tries++<120)setTimeout(wait,250);
  };
  wait();
})();
