(()=>{
  if(window.__NICE_BRIDGE_V12)return;
  window.__NICE_BRIDGE_V12=true;

  // Link permanente para o novo Sistema de Protocolos, sem interferir nas abas do painel.
  const nav=document.querySelector('.tabs');
  if(nav&&!document.getElementById('nice-protocolos-link')){
    const a=document.createElement('a');
    a.id='nice-protocolos-link';
    a.href='protocolos/';
    a.textContent='Protocolos';
    a.style='border:0;background:#17365d;padding:10px 16px;border-radius:9px;font-weight:700;color:#fff;cursor:pointer;text-decoration:none;font:700 14px Segoe UI,Arial,sans-serif';
    nav.appendChild(a);
  }

  const show=msg=>{
    console.error(msg);
    let b=document.getElementById('nice-runtime-error');
    if(!b){
      b=document.createElement('div');b.id='nice-runtime-error';
      b.style='max-width:1400px;margin:12px auto;padding:12px 14px;background:#fff1f2;color:#991b1b;border:1px solid #ef4444;border-radius:10px;font:13px Segoe UI,Arial';
      document.querySelector('main')?.prepend(b);
    }
    b.textContent=msg;
  };
  window.addEventListener('error',e=>{if(!window.__NICE_UI_OK)show('Erro JavaScript no painel: '+(e.message||'erro desconhecido')+(e.filename?' · '+e.filename.split('/').pop()+':'+e.lineno:''))});
  window.addEventListener('unhandledrejection',e=>{if(!window.__NICE_UI_OK)show('Erro ao inicializar os dados: '+(e.reason?.message||e.reason||'falha assíncrona'))});
  let tries=0;
  const boot=()=>{
    try{
      if(typeof window.__NICE_DATA!=='string'||window.__NICE_DATA.length<1000)throw new Error('aguardando base');
      const raw=JSON.parse(window.__NICE_DATA);
      if(raw.n!==1320||raw.rn!==379||!raw.p||!raw.r)throw new Error('base incompleta');
      if(window.__NICE_UI_STARTED)return;
      const s=document.createElement('script');
      s.src='dashboard_v12.js?ts='+Date.now();
      s.onload=()=>console.info('NICE: dashboard carregado');
      s.onerror=()=>show('Não foi possível carregar o dashboard institucional.');
      document.body.appendChild(s);
    }catch(err){
      if(tries++<300){setTimeout(boot,50);return}
      show('A base não terminou de carregar. Atualize a página com Ctrl+F5.');
    }
  };
  boot();
})();