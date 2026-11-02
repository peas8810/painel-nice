/* One task at a time. Existing forms and server permissions are preserved. */
(()=>{
 const student=document.getElementById('student-view');if(!student)return;
 const screens=[...student.querySelectorAll('.academy-screen')],nav=student.querySelector('.mobile-quick-nav');
 const aliases={'student-view':'academy-home','preferences-section':'academy-account','connected-apps-section':'academy-account','academic-record':'certificate-wallet','case-form':'help-center','student-feedback':'help-center'};
 function show(id,{focus=true,history=true}={}){
  id=aliases[id]||id;const target=screens.find(x=>x.id===id);if(!target)return false;
  for(const s of screens)s.hidden=s!==target;
  for(const a of nav.querySelectorAll('a')){if(a.hash==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(history&&location.hash!=='#'+id)window.history.pushState(null,'','#'+id);
  if(focus){const h=target.querySelector('h2,h3');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}target.scrollIntoView({behavior:'auto',block:'start'});}
  return true;
 }
 window.academyOpenSection=id=>show(id);
 document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(a&&student.contains(a)&&show(a.hash.slice(1)))e.preventDefault();});
 window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'academy-home',{history:false}));
 window.addEventListener('popstate',()=>show(location.hash.slice(1)||'academy-home',{history:false}));
 window.addEventListener('academy-request-saved',()=>{show('upload-section');const status=document.getElementById('evidence-status');if(status)status.textContent='Pedido salvo. Agora escolha o pedido e envie os quatro tipos de documento abaixo.';});
 const extra=document.getElementById('advanced-navigation'),shared=document.getElementById('academy-navigation');if(extra&&shared)extra.append(shared);
 show(location.hash.slice(1)||'academy-home',{focus:false,history:false});
})();
