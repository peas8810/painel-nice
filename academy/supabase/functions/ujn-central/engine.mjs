export const SERVICES={revistas:'Revistas científicas',escrita:'Auxílio à escrita',articlerun:'Submissão de artigos',academy:'Certificados Academy',suporte:'Pagamentos e suporte'};
export function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
export function resolveService(text){const t=normalize(text);return Object.entries(SERVICES).find(([k,v])=>t===k||t===normalize(v))?.[0]||({'1':'revistas','2':'escrita','3':'articlerun','4':'academy','5':'suporte'}[t]);}
export const serviceMenu=()=>Object.values(SERVICES);
export function validQuestions(raw){if(!Array.isArray(raw)||raw.length>12)throw Error('Use até 12 perguntas.');const keys=new Set();for(const q of raw){if(!/^[a-z][a-z0-9_]{0,30}$/.test(q.key)||keys.has(q.key)||typeof q.label!=='string'||q.label.trim().length<3||q.label.length>250)throw Error('Pergunta inválida ou identificador repetido.');keys.add(q.key);}return raw;}
export async function serviceTurn(c,input,dep){
 const text=String(input.text||''),t=normalize(text),state=structuredClone(c.bot_state||{}),flow=c.flow_snapshot;
 const response=(body,choices=[],handoff=false,links=[])=>({state,text:body,choices,handoff,links});
 if(t==='falar com uma pessoa'||t==='falar com a equipe')return response('Sua conversa entrou na fila da equipe. Você pode continuar enviando informações por aqui. O assistente ficará pausado até o atendimento ser devolvido.',[],true);
 if(c.service_id==='academy'){
  if(!input.userId)return response('Para acessar pedidos e documentos privados, conecte sua conta no portal. Depois, vincule este WhatsApp. Nunca envie sua senha nesta conversa.',['Falar com uma pessoa'],false,[{label:'Entrar na conta',url:'https://www.protocolo.me/academy/portal/#academy-chat'}]);
  const r=await dep.academy(input.userId,input.event,{text,file:input.file});return response(r.text,[...(r.choices||[]).filter(x=>x!=='Falar com a equipe'),'Falar com uma pessoa'],false,r.links||[]);
 }
 if(input.file){await dep.upload(input.file);return response('Arquivo recebido na central UJN. O recebimento não significa submissão à revista. Continue a conversa ou fale com a equipe.',['Continuar','Falar com uma pessoa']);}
 if(t==='regras'||t==='informacoes')return response(flow.knowledge||'A equipe pode esclarecer as regras deste serviço.',['Iniciar atendimento','Falar com uma pessoa']);
 const qs=flow.questions||[];
 if(t==='iniciar atendimento'||t==='corrigir'){state.answers={};state.step=0;return response(qs[0]?.label||flow.welcome,['Falar com uma pessoa'],!qs.length);}
 if(t==='confirmar encaminhamento'&&state.step==='confirm'){state.confirmed=true;state.confirmed_at=new Date().toISOString();return response(c.service_id==='articlerun'?'Recebemos os dados na central UJN. Ainda NÃO houve submissão externa. A equipe verificará o arquivo e a integração com ArticleRun antes de encaminhar. Você pode anexar o manuscrito aqui.':'Recebemos sua solicitação. A equipe vai continuar o atendimento. Você pode enviar os documentos necessários aqui.',[],true);}
 if(state.step==='confirm')return response('Confira as informações:\n'+qs.map(q=>q.label+'\n'+state.answers[q.key]).join('\n\n')+'\n\nConfirma o encaminhamento para a equipe?',['Confirmar encaminhamento','Corrigir','Falar com uma pessoa']);
 if(Number.isInteger(state.step)&&qs[state.step]){if(t==='continuar')return response(qs[state.step].label,['Falar com uma pessoa']);if(text.trim().length<2||text.length>2500)return response('Escreva uma resposta de 2 a 2.500 caracteres.\n'+qs[state.step].label,['Falar com uma pessoa']);state.answers[qs[state.step].key]=text.trim();state.step++;if(state.step<qs.length)return response(qs[state.step].label,['Falar com uma pessoa']);state.step='confirm';return response('Confira as informações:\n'+qs.map(q=>q.label+'\n'+state.answers[q.key]).join('\n\n')+'\n\nConfirma o encaminhamento para a equipe?',['Confirmar encaminhamento','Corrigir','Falar com uma pessoa']);}
 return response(flow.welcome+'\n\n'+(flow.knowledge||''),['Iniciar atendimento','Informações','Falar com uma pessoa']);
}
