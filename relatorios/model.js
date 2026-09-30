(function(root){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const same=(a,b)=>String(a||'').replace(/^0+(?=\d)/,'')===String(b||'').replace(/^0+(?=\d)/,'');
  function day(v){if(!v)return '';const s=String(v);if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){const [d,m,y]=s.split('/');return `${y}-${m}-${d}`;}if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const d=new Date(v);return isNaN(d)?'':new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function build(source,f){
    const range=v=>{const d=day(v);return (!f.from&&!f.to)||!!d&&(!f.from||d>=f.from)&&(!f.to||d<=f.to)};
    const query=x=>!f.query||norm(Object.values(x).join(' ')).includes(norm(f.query));
    const status=x=>!f.state||x.status===f.state;
    const certStatus=c=>['event','open'].includes(f.kind)||status(c);
    const events=(source.events||[]).filter(e=>(!f.institution||e.instituicao_emissora===f.institution)&&(!f.responsible||e.responsavel===f.responsible)&&(!f.event||same(e.id,f.event))&&status(e)&&range(e.data_evento)&&query(e));
    const projects=(source.projects||[]).filter(p=>!f.institution&&!f.event&&(!f.responsible||p.responsavel===f.responsible)&&status(p)&&range(p.data_inicio)&&query(p));
    const certificates=Array.from(new Map((source.certificates||[]).filter(c=>!!c.codigo).map(c=>[c.codigo,c])).values()).filter(c=>{
      const e=(source.events||[]).find(e=>same(e.id,c.evento_id));return (!f.institution||(c.instituicao_emissora||e?.instituicao_emissora)===f.institution)&&(!f.responsible||e?.responsavel===f.responsible)&&(!f.event||same(c.evento_id,f.event))&&certStatus(c)&&range(c.emitido_em)&&query({...c,event_title:e?.titulo||'',event_responsible:e?.responsavel||''});
    });
    function emissionState(e){if(e.status!=='EMISSAO_ABERTA')return 'FECHADA';const now=Date.now(),start=Date.parse(e.emissao_inicio),end=Date.parse(e.emissao_fim);return Number.isFinite(start)&&now<start?'AGENDADA':Number.isFinite(end)&&now>end?'ENCERRADA':'ABERTA';}
    const open=events.filter(e=>emissionState(e)==='ABERTA');
    const pending=[];projects.forEach(p=>{if(['AGUARDANDO_RELATORIO','RELATORIO_EM_ATRASO'].includes(p.status))pending.push([p.id,p.titulo,p.responsavel||'—',p.status,p.prazo_relatorio||'—']);if(!p.responsavel)pending.push([p.id,p.titulo,'—','Sem responsável','—'])});
    events.forEach(e=>{if(!e.responsavel)pending.push([e.id,e.titulo,'—','Sem responsável','—']);if(e.status==='EMISSAO_ABERTA'&&emissionState(e)==='ENCERRADA')pending.push([e.id,e.titulo,e.responsavel||'—','Período encerrado; status ainda aberto',e.emissao_fim]);});
    certificates.forEach(c=>{if(!['ATIVO','ENVIADO','REVOGADO'].includes(c.status))pending.push([c.codigo,c.evento_id,'—',c.status||'Sem situação',c.emitido_em||'—']);if(!c.livro_digital||!c.registro_digital)pending.push([c.codigo,c.evento_id,'—','Sem Livro/Registro informado',c.emitido_em||'—'])});
    const issued=certificates.filter(c=>['ATIVO','ENVIADO','REVOGADO'].includes(c.status)).length;
    const metrics=[['Projetos',projects.length],['Projetos abertos',projects.filter(p=>!['FINALIZADO','CANCELADO'].includes(p.status)).length],['Projetos finalizados',projects.filter(p=>p.status==='FINALIZADO').length],['Eventos',events.length],['Emissão aberta agora',open.length],['Certificados registrados',issued],['Revogados',certificates.filter(c=>c.status==='REVOGADO').length],['Pendências',pending.length]];
    return {projects,events,certificates,open,pending,metrics,emissionState};
  }
  const api={build,day,same,norm};root.ReportModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
