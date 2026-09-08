(()=>{
 if(window.__NICE_LOADER_ACTIVE)return;
 window.__NICE_LOADER_ACTIVE=true;
 let tries=0;
 const start=()=>{
  try{
   const raw=JSON.parse(window.__NICE_DATA||'');
   if(!raw||raw.n!==1320||raw.rn!==379)throw new Error('base ainda não pronta');
   if(window.__NICE_DASHBOARD_LOADED)return;
   window.__NICE_DASHBOARD_LOADED=true;
   const s=document.createElement('script');
   s.src='dashboard.js?v=5';
   s.onload=()=>console.info('NICE dashboard carregado com sucesso');
   s.onerror=()=>show('Falha ao carregar a lógica do dashboard.');
   document.body.appendChild(s);
  }catch(e){
   if(tries++<240){setTimeout(start,50);return}
   show('A base de dados não pôde ser inicializada. Recarregue a página com Ctrl+F5.');
  }
 };
 const show=msg=>{
  console.error(msg);
  let box=document.getElementById('nice-load-error');
  if(!box){box=document.createElement('div');box.id='nice-load-error';box.style='max-width:1200px;margin:16px auto;padding:14px 16px;border:1px solid #ef4444;background:#fff1f2;color:#991b1b;border-radius:10px;font:14px Segoe UI,Arial';document.querySelector('main')?.prepend(box)}
  box.textContent=msg;
 };
 start();
})();
