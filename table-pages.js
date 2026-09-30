/* Shared pagination. Keeps every filtered row available; never truncates the source. */
(()=>{
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function attach(body){
    if(body.dataset.paged)return;body.dataset.paged='1';
    const wrap=body.closest('.table-wrap,.tablewrap,.public-table-wrap')||body.closest('table');
    const bar=document.createElement('div');bar.className='table-pagination';
    bar.innerHTML='<label>Filtrar esta lista <input type="search" aria-label="Filtrar linhas da tabela" placeholder="Pesquisar nesta lista"></label><label>Linhas por página <select aria-label="Linhas por página"><option>30</option><option>50</option><option>80</option></select></label><button type="button">Anterior</button><span aria-live="polite"></span><button type="button">Próxima</button>';
    wrap.after(bar);
    const search=bar.querySelector('input');if(location.pathname.includes('/relatorios/'))search.closest('label').hidden=true;const size=bar.querySelector('select'),buttons=bar.querySelectorAll('button'),info=bar.querySelector('span');let page=1,lastSignature='';
    function render(){
      const all=Array.from(body.children).filter(r=>r.tagName==='TR');
      const signature=all.map(r=>r.textContent).join('\n');if(signature!==lastSignature){page=1;lastSignature=signature;}
      const empty=all.length===1&&all[0].children.length===1&&all[0].children[0].hasAttribute('colspan');
      const rows=empty?[]:all.filter(r=>norm(r.textContent).includes(norm(search.value)));
      const count=rows.length,n=Number(size.value),pages=Math.max(1,Math.ceil(count/n));page=Math.min(page,pages);
      const shown=new Set(rows.slice((page-1)*n,page*n));all.forEach(r=>{r.hidden=!empty&&!shown.has(r)});
      info.textContent=count?`${(page-1)*n+1}–${Math.min(page*n,count)} de ${count} · Página ${page} de ${pages}`:'Nenhuma linha encontrada';
      buttons[0].disabled=page<=1;buttons[1].disabled=page>=pages;
    }
    search.addEventListener('input',()=>{page=1;render()});size.addEventListener('change',()=>{page=1;render()});
    buttons[0].onclick=()=>{page--;render()};buttons[1].onclick=()=>{page++;render()};
    new MutationObserver(render).observe(body,{childList:true});render();
  }
  function scan(){document.querySelectorAll('tbody').forEach(attach)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',scan):scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
