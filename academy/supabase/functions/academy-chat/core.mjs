export const MENU=['Novo pedido','Meus pedidos','Documentos','Pagamento','Certificado','Regras','Falar com a equipe'];
export const CATEGORIES={PRESENCA:'Lista de presença',FOTOS:'Fotos da atividade',ARTES:'Cartaz ou convite',CONTEUDO:'Conteúdo ensinado'};
const steps=[['activity','Qual é o nome do curso, aula ou oficina?'],['activity_type','Que tipo de atividade foi? Por exemplo: curso, aula ou oficina.'],['start_date','Em que dia começou? Escreva dia/mês/ano.'],['end_date','Em que dia terminou? Escreva dia/mês/ano.'],['hours_declared','Quantas horas durou ao todo? Exemplo: duas aulas de 2 horas somam 4 horas.'],['participants_count','Quantas pessoas participaram?'],['teaching_activity','Houve ensino de algum conteúdo? Responda Sim ou Não.'],['description','Conte o que foi ensinado, em pelo menos uma frase.']];
export function normal(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
export function parseField(key,value){
 const s=String(value).trim();
 if(key.endsWith('_date')){const a=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/),iso=a?`${a[3]}-${a[2]}-${a[1]}`:s;if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error('Use uma data válida, como 25/10/2026.');return iso;}
 if(key==='hours_declared'||key==='participants_count'){const n=Number(s.replace(',','.'));if(!s||!Number.isFinite(n)||(key==='hours_declared'?(n<0||n>300):(n<2||!Number.isInteger(n)||n>100000)))throw Error(key==='hours_declared'?'Informe de 0 a 300 horas.':'A atividade precisa ter pelo menos duas pessoas. Informe um número inteiro.');return n;}
 if(key==='teaching_activity'){if(normal(s)!=='sim')throw Error('São aceitas atividades de ensino. Se precisar de ajuda, escreva “Falar com a equipe”.');return true;}
 const limits={activity:[3,180],activity_type:[2,80],description:[15,2000]},[min,max]=limits[key];if(s.length<min||s.length>max)throw Error(`Escreva entre ${min} e ${max} caracteres.`);return s;
}
export function validateDraft(d){for(const [k] of steps)parseField(k,k==='teaching_activity'?(d[k]===true?'Sim':'Não'):d[k]??'');if(d.end_date<d.start_date)throw Error('O fim não pode ser antes do início. Escreva “Corrigir” para preencher novamente.');return d;}
export function summary(d){return `Confira antes de enviar:\n${d.activity}\nTipo: ${d.activity_type}\nDe ${d.start_date.split('-').reverse().join('/')} a ${d.end_date.split('-').reverse().join('/')}\n${d.hours_declared} horas · ${d.participants_count} pessoas\nAtividade de ensino: sim\n${d.description}\n\nEstes dados ainda serão analisados pela equipe.`;}
export function mediaType(bytes){if(bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d)return ['application/pdf','pdf'];if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return ['image/jpeg','jpg'];if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return ['image/png','png'];throw Error('Envie PDF, JPG ou PNG.');}
export function safeCheckout(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['www.mercadopago.com.br','mercadopago.com.br','www.mercadopago.com','mercadopago.com'].includes(u.hostname)?u.href:null;}catch{return null;}}
export async function turn(state,input,dep){
 const s=structuredClone(state||{}),t=normal(input.text),say=(text,choices=MENU,links=[])=>({state:s,response:{text,choices,links}});
 if(t==='falar com a equipe'){s.step=null;return say('Você pode falar com a equipe pelo atendimento do portal ou pelo e-mail contato@ujn.ojsbr.com. Informe o número do pedido, se já tiver um.',MENU,[{label:'Abrir atendimento',url:'https://www.protocolo.me/academy/portal/#help-center'}]);}
 if(t==='menu'||t==='cancelar rascunho'){s.step=null;s.draft=null;return say('Como posso ajudar? Escolha uma opção.');}
 if(t==='novo pedido'||t==='corrigir'){s.draft={};s.draftId=dep.uuid();s.step=0;return say('Vamos montar seu pedido, uma pergunta por vez. Nada será enviado antes da sua confirmação.\n\n'+steps[0][1],['Cancelar rascunho','Falar com a equipe']);}
 if(t==='autorizar ia'){s.aiConsent=true;return say('IA ativada. Escreva sua dúvida. As respostas são orientações e não substituem a análise humana. Você pode escrever “Desativar IA” a qualquer momento.');}
 if(t==='desativar ia'){s.aiConsent=false;return say('IA desativada. As opções guiadas continuam funcionando.');}
 if(t==='regras'){const rules=await dep.rules();return say(rules.text,MENU,rules.links);}
 if(t==='meus pedidos'){const rows=await dep.requests();s.list=rows.map(x=>x.id);s.step=null;return say(rows.length?'Seus pedidos:\n'+rows.map((x,i)=>`${i+1}. ${x.activity} — ${dep.status(x.status)}`).join('\n')+'\n\nDigite o número do pedido para escolher.':'Você ainda não tem pedidos. Escolha “Novo pedido”.',MENU);}
 if(s.list&&/^\d+$/.test(t)&&s.step==null){const id=s.list[Number(t)-1];if(!id)return say('Escolha um número da lista.');s.requestId=id;s.category=null;s.list=null;const r=await dep.request(id);return say(`Pedido selecionado: ${r.activity}\n${dep.status(r.status)}\n\nO que você quer fazer?`,['Documentos','Pagamento','Certificado','Meus pedidos']);}
 if(['documentos','pagamento','certificado'].includes(t)){
  if(!s.requestId)return say('Primeiro escolha “Meus pedidos” e depois o número do pedido.',['Meus pedidos','Novo pedido']);
  const r=await dep.request(s.requestId);
  if(t==='documentos'){s.step=null;s.category=null;const e=await dep.evidence(r.id);return say('Envie um arquivo de cada vez. Aceitamos PDF, JPG e PNG de até 10 MB.\n\n'+Object.entries(CATEGORIES).map(([k,v])=>`${v}: ${e.some(x=>x.category===k)?'recebido (sujeito à análise)':'falta enviar'}`).join('\n')+'\n\nEscolha o tipo do próximo documento.',Object.values(CATEGORIES));}
  if(t==='pagamento')return say(...await dep.payment(r));
  return say(...await dep.certificate(r));
 }
 const category=Object.entries(CATEGORIES).find(([,v])=>normal(v)===t);
 if(category){if(!s.requestId)return say('Escolha um pedido antes de enviar documentos.',['Meus pedidos']);s.category=category[0];s.step=null;return say(`Agora envie o arquivo de ${category[1].toLowerCase()}. Ele ficará privado e será conferido pela equipe.`,['Documentos','Meus pedidos']);}
 if(input.file){if(!s.requestId||!s.category)return say('Antes do arquivo, escolha o pedido e o tipo de documento.',['Meus pedidos','Documentos']);const r=await dep.request(s.requestId);await dep.upload(r,s.category,input.file);return say('Arquivo recebido. Ele ainda precisa ser analisado. Escolha “Documentos” para conferir o que falta.',['Documentos','Meus pedidos']);}
 if(t==='confirmar envio'&&s.step==='confirm'){
  validateDraft(s.draft);const r=await dep.submit(s.draftId,s.draft);s.requestId=r.id;s.step=null;s.draft=null;s.category=null;
  return say(`Recebemos seu pedido ${r.id.slice(0,8)}. Agora envie os quatro tipos de documento. A aprovação será feita por uma pessoa da equipe.`,['Documentos','Meus pedidos']);
 }
 if(Number.isInteger(s.step)&&s.draft){const [key]=steps[s.step];s.draft[key]=parseField(key,input.text);if(key==='end_date'&&s.draft.end_date<s.draft.start_date)throw Error('O término não pode ser anterior ao início. Informe outra data de término.');s.step++;
  if(s.step<steps.length)return say(steps[s.step][1],steps[s.step][0]==='teaching_activity'?['Sim','Falar com a equipe']:['Cancelar rascunho','Falar com a equipe']);
  validateDraft(s.draft);s.step='confirm';return say(summary(s.draft),['Confirmar envio','Corrigir','Cancelar rascunho']);
 }
 if(s.step==='confirm')return say(summary(s.draft),['Confirmar envio','Corrigir','Cancelar rascunho']);
 if(!t||['oi','ola','iniciar'].includes(t))return say('Olá! Sou o assistente virtual do Academy. Posso orientar, montar seu pedido e ajudar com documentos, pagamento e certificado. Escolha uma opção.');
 if(!s.aiConsent)return say('Para responder uma pergunta livre, o texto dela será enviado ao serviço de IA da OpenAI, junto das regras publicadas. Não inclua dados pessoais desnecessários. Fotos e documentos não são enviados à IA por este chat. Você autoriza? Depois de autorizar, escreva a pergunta novamente.',['Autorizar IA','Regras','Menu']);
 return say(await dep.answer(input.text),MENU,[{label:'Regulamento UJN',url:'https://www.protocolo.me/academy/regulamento/'}]);
}
