/* Academy student growth: simple guided entry, search, printable activity record and satisfaction. */
(()=>{
const $=id=>document.getElementById(id), client=()=>window.academyDb;
let records=[];
$('guided-fill').onclick=()=>{
 const story=$('guided-story').value.trim();
 if(story.length<15){$('guided-status').textContent='Descreva a atividade com mais detalhes.';return}
 const hours=story.match(/(\d{1,3}(?:[,.]\d+)?)\s*(?:horas?|h\b)/i);
 const date=story.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
 const title=story.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,'').replace(/\b\d+[,.]?\d*\s*(?:horas?|h\b)/gi,'').slice(0,150).trim();
 if(!$('activity').value)$('activity').value=title||story.slice(0,150);
 $('description').value=story;
 if(hours&&!$('hours').value)$('hours').value=hours[1].replace(',','.');
 if(date){const d=date[3]+'-'+date[2].padStart(2,'0')+'-'+date[1].padStart(2,'0');if(!$('start').value)$('start').value=d;if(!$('end').value)$('end').value=d}
 window.academyWizardSetStep?.(1);
 $('new-request').scrollIntoView({behavior:'smooth'});
 $('guided-status').textContent='Dados iniciais organizados. Confira e complete todas as informações antes de registrar.';
 $('request').dispatchEvent(new Event('input',{bubbles:true}));
};
$('student-request-search').addEventListener('input',()=>{
 const q=$('student-request-search').value.trim().toLocaleLowerCase('pt-BR');
 for(const card of $('tracking').querySelectorAll('.request-item'))card.hidden=!!q&&!card.textContent.toLocaleLowerCase('pt-BR').includes(q)
});
async function refresh(){
 const db=client();if(!db)return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {data,error}=await db.from('academy_requests').select('id,activity,activity_type,start_date,end_date,hours_declared,hours_verified,status,created_at').eq('user_id',user.id).neq('status','CANCELADA').order('created_at',{ascending:false}).limit(500);
 if(error){$('academic-record-summary').textContent='Não foi possível consultar o histórico.';return}
 records=data||[];
 const verified=records.reduce((sum,r)=>sum+(r.status==='APROVADO'?Number(r.hours_verified||0):0),0);
 const summary=$('academic-record-summary');summary.replaceChildren();
 const p=document.createElement('p');p.textContent=records.length+' protocolo(s) · '+verified.toLocaleString('pt-BR')+' horas verificadas em atividades aprovadas.';summary.append(p);
 for(const r of records.slice(0,8)){const line=document.createElement('p');line.className='record-line';line.textContent=r.activity+' · '+r.status+' · '+(r.hours_verified??'—')+' horas verificadas';summary.append(line)}
}
$('export-academic-record').onclick=()=>{
 if(!records.length){alert('Não há atividades para exportar.');return}
 const safe=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const doc='<html lang="pt-BR"><head><meta charset="utf-8"><title>Histórico complementar — Academy</title><style>body{font:15px Arial,sans-serif;margin:32px;color:#17314c}table{border-collapse:collapse;width:100%}td,th{padding:9px;border:1px solid #bbb;text-align:left}small{color:#555}</style></head><body><h1>Histórico complementar de atividades</h1><p>Gerado em '+new Date().toLocaleString('pt-BR')+'</p><small>Relatório informativo. Não substitui documento acadêmico oficial.</small><table><thead><tr><th>Atividade</th><th>Período</th><th>Status</th><th>Horas verificadas</th></tr></thead><tbody>'+records.map(r=>'<tr><td>'+safe(r.activity)+'</td><td>'+safe(r.start_date)+' a '+safe(r.end_date)+'</td><td>'+safe(r.status)+'</td><td>'+safe(r.hours_verified??'—')+'</td></tr>').join('')+'</tbody></table></body></html>';
 const blob=new Blob([doc],{type:'text/html'}),url=URL.createObjectURL(blob),win=window.open(url,'_blank','noopener,noreferrer');if(!win){alert('Habilite pop-ups para imprimir o histórico.');URL.revokeObjectURL(url);return}setTimeout(()=>URL.revokeObjectURL(url),30000);
};
window.addEventListener('academy-requests-loaded',refresh);setTimeout(refresh,1200);
})();
