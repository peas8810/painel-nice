/** Academy — gestão administrativa de protocolos e tipos. Sem doGet.
 * Instalar no Apps Script PRIVADO. Serviço Supabase opcional usa chave SOMENTE em Script Properties.
 */
function academyGestaoAuth_(){return academyIntegracaoAuth_();}
function academyGestaoSheet_(name){const sh=SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID).getSheetByName(name);if(!sh)throw new Error('Aba não encontrada: '+name);return sh;}
function academyGestaoRows_(name){const sh=academyGestaoSheet_(name);const rows=sh.getDataRange().getValues();return rows.slice(1).filter(r=>String(r[0]||'').trim());}
function academyGestaoTipos(){
 academyGestaoAuth_();
 const defaults=['Grupo de estudos','Projeto colaborativo','Ação comunitária','Oficina independente','Capacitação interna','Outra'];
 const sh=academyGestaoSheet_('CONFIGURACOES');const rows=sh.getDataRange().getDisplayValues();
 const hidden=new Set(rows.slice(1).filter(r=>r[0]==='TIPO_ATIVIDADE'&&r[2]==='INATIVO').map(r=>String(r[1]).toLowerCase()));
 const saved=rows.slice(1).filter(r=>r[0]==='TIPO_ATIVIDADE'&&r[2]!=='INATIVO').map(r=>r[1]).filter(Boolean);
 return [...new Set([...defaults,...saved].filter(x=>!hidden.has(String(x).toLowerCase())))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
}
function academyGestaoTipoAdicionar(nome){
 academyGestaoAuth_();nome=String(nome||'').trim().replace(/\s+/g,' ');
 if(nome.length<3||nome.length>80||/^[=+@-]/.test(nome))throw new Error('Nome inválido (3–80 caracteres).');
 if(academyGestaoTipos().some(x=>x.toLowerCase()===nome.toLowerCase()))throw new Error('Tipo já cadastrado.');
 const con=academyGestaoConfigSupabase_();
 if(con)academyGestaoSupabase_('academy_activity_types','post',{name:nome,active:true});
 academyGestaoSheet_('CONFIGURACOES').appendRow(['TIPO_ATIVIDADE',nome,'ATIVO',new Date(),academyGestaoAuth_()]);
 return academyGestaoTipos();
}
function academyGestaoTipoRenomear(anterior,novo){
 academyGestaoAuth_();
 anterior=String(anterior||'').trim();novo=String(novo||'').trim().replace(/\s+/g,' ');
 if(!academyGestaoTipos().includes(anterior))throw new Error('Tipo anterior não encontrado');
 if(novo.length<3||novo.length>80||/^[=+@-]/.test(novo))throw new Error('Novo nome inválido');
 if(academyGestaoTipos().some(x=>x.toLowerCase()===novo.toLowerCase()))throw new Error('Novo nome já existe');
 const con=academyGestaoConfigSupabase_();
 if(con)academyGestaoSupabase_('academy_activity_types?name=eq.'+encodeURIComponent(anterior),'patch',{name:novo});
 const sh=academyGestaoSheet_('CONFIGURACOES');
 sh.appendRow(['TIPO_ATIVIDADE',anterior,'INATIVO',new Date(),academyGestaoAuth_()]);
 sh.appendRow(['TIPO_ATIVIDADE',novo,'ATIVO',new Date(),academyGestaoAuth_()]);
 return academyGestaoTipos();
}
function academyGestaoConfigSupabase_(){
 const p=PropertiesService.getScriptProperties(),url=String(p.getProperty('ACADEMY_SUPABASE_URL')||'').replace(/\/$/,'');
 const key=p.getProperty('ACADEMY_SUPABASE_SECRET_KEY')||'';
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)return null;
 return {url,key};
}
function academyGestaoSupabase_(path,method,body){
 const cfg=academyGestaoConfigSupabase_();if(!cfg)throw new Error('Conexão administrativa Supabase não configurada.');
 const options={method:method||'get',muteHttpExceptions:true,headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json',Prefer:'return=representation'}};
 if(body!==undefined)options.payload=JSON.stringify(body);
 const res=UrlFetchApp.fetch(cfg.url+'/rest/v1/'+path,options),status=res.getResponseCode();
 if(status<200||status>=300)throw new Error('Falha ao consultar o Supabase (HTTP '+status+').');
 return res.getContentText()?JSON.parse(res.getContentText()):[];
}
function academyGestaoLista(){
 academyGestaoAuth_();
 const alunos=new Map(academyGestaoRows_('ALUNOS').map(r=>[String(r[0]),{nome:String(r[1]||''),email:String(r[2]||'')}]));
 const evi=academyGestaoRows_('EVIDENCIAS'),valid=academyGestaoRows_('VALIDACOES');
 const result=academyGestaoRows_('SOLICITACOES').map(r=>{
  const id=String(r[0]),aluno=alunos.get(String(r[1]))||{};
  const evidencias=evi.filter(v=>String(v[1])===id);
  return {origem:'SHEETS',id,aluno:aluno.nome||'Não identificado',email:aluno.email||'',
    atividade:String(r[2]||''),tipo:String(r[3]||''),horas:Number(r[7])||0,
    status:String(r[10]||''),evidencias:evidencias.length,criado:String(r[11]||'')};
 });
 const con=academyGestaoConfigSupabase_();
 let aviso='';
 if(con){
  try{const requests=academyGestaoSupabase_('academy_requests?select=id,user_id,activity,activity_type,hours_declared,status,created_at&order=created_at.desc&limit=200');
   requests.forEach(x=>result.push({origem:'SUPABASE',id:x.id,aluno:'Aluno Supabase',email:'',atividade:x.activity,tipo:x.activity_type,horas:Number(x.hours_declared)||0,status:x.status,evidencias:0,criado:x.created_at}));
  }catch(e){aviso='Supabase indisponível: '+e.message}
 }else aviso='Integração Supabase administrativa ainda não configurada; pedidos do portal não aparecem aqui.';
 return {pedidos:result,aviso,tipos:academyGestaoTipos()};
}
function academyGestaoDetalhe(origem,id){
 academyGestaoAuth_();origem=String(origem);id=String(id);
 if(origem==='SUPABASE'){
  const rows=academyGestaoSupabase_('academy_requests?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1');
  if(!rows.length)throw new Error('Protocolo não encontrado');
  const x=rows[0];return {origem,id,atividade:x.activity,tipo:x.activity_type,descricao:x.description,
  horas:x.hours_declared,horasVerificadas:x.hours_verified,status:x.status,inicio:x.start_date,fim:x.end_date,
  evidencias:[],nota:'Comprovantes ainda não disponíveis no fluxo público. Não é permitido aprovar este protocolo.'};
 }
 const sh=academyGestaoSheet_('SOLICITACOES'),rows=sh.getDataRange().getDisplayValues();
 const r=rows.slice(1).find(x=>x[0]===id);if(!r)throw new Error('Protocolo não encontrado');
 const evidencias=academyGestaoRows_('EVIDENCIAS').filter(x=>String(x[1])===id).map(x=>({id:String(x[0]),nome:String(x[4]||''),tipo:String(x[2]||''),estado:String(x[7]||''),arquivoId:String(x[3]||'')}));
 const pareceres=academyGestaoRows_('VALIDACOES').filter(x=>String(x[1])===id).map(x=>({resultado:String(x[3]||''),justificativa:String(x[4]||''),horas:Number(x[5])||0}));
 return {origem,id,atividade:r[2],tipo:r[3],descricao:r[9],horas:Number(r[7])||0,horasVerificadas:Number(r[8])||0,status:r[10],
 inicio:r[5],fim:r[6],evidencias:evidencias.map(({arquivoId,...rest})=>rest),pareceres};
}
function academyGestaoEvidenciaUrl(id,evidenciaId){
 academyGestaoAuth_();
 const r=academyGestaoRows_('EVIDENCIAS').find(x=>String(x[0])===String(evidenciaId)&&String(x[1])===String(id));
 if(!r)throw new Error('Evidência não encontrada no protocolo.');
 const file=DriveApp.getFileById(String(r[3]));
 // O arquivo permanece privado. Link é útil apenas se a conta Google possuir permissão direta.
 return {nome:file.getName(),url:file.getUrl(),privado:true};
}
function academyGestaoDecidir(d){
 academyGestaoAuth_();
 if(!d||!['SHEETS','SUPABASE'].includes(d.origem))throw new Error('Origem inválida');
 const id=String(d.id||''),resultado=String(d.resultado||''),justificativa=String(d.justificativa||'').trim();
 if(!['APROVADO','REPROVADO','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(resultado))throw new Error('Resultado inválido');
 if(justificativa.length<15||justificativa.length>2000)throw new Error('Justificativa deve ter entre 15 e 2000 caracteres');
 if(d.origem==='SUPABASE'){
  if(resultado==='APROVADO')throw new Error('Sem upload autenticado de evidências no Supabase: aprovação bloqueada.');
  const row=academyGestaoDetalhe('SUPABASE',id);
  if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(row.status))throw new Error('Pedido não permite nova decisão');
  academyGestaoSupabase_('academy_requests?id=eq.'+encodeURIComponent(id),'patch',{status:resultado,updated_at:new Date().toISOString()});
  academyGestaoSheet_('AUDITORIA').appendRow(['AUD-'+Utilities.getUuid(),'SUPABASE',id,'PARECER_ADMINISTRATIVO',academyGestaoAuth_(),new Date(),JSON.stringify({resultado,justificativa})]);
  return {sucesso:true,resultado};
 }
 const detail=academyGestaoDetalhe('SHEETS',id);
 if(resultado==='APROVADO'&&!detail.evidencias.length)throw new Error('Não é possível aprovar sem evidências.');
 const result=academyRevisarSolicitacao({solicitacaoId:id,resultado,justificativa,horasVerificadas:Number(d.horasVerificadas)||0});
 return result;
}

/** Autoriza a etapa seguinte, mas NÃO emite PDF nem altera CERTIFICADOS.
 * O módulo de emissão definitiva permanece desligado até homologação.
 */
function academyGestaoAutorizarEmissao(origem,id){
 const admin=academyGestaoAuth_();
 if(origem!=='SHEETS')throw new Error('Protocolos do Supabase não podem ser liberados sem integração documental.');
 id=String(id||'').trim();if(!id)throw new Error('Protocolo ausente.');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const detail=academyGestaoDetalhe('SHEETS',id);
  if(detail.status!=='APROVADO')throw new Error('A análise documental não está aprovada.');
  if(!detail.evidencias.length||detail.evidencias.every(x=>/TESTE|NAO_VALIDADO/i.test(x.estado)))
   throw new Error('Não há evidência apta à liberação.');
  if(typeof academyEmissaoChecar_!=='function')throw new Error('Módulo central de checagem ausente.');
  const gate=academyEmissaoChecar_(id);
  if(!gate.apto||!gate.documentacaoAprovada||!gate.pagamentoConfirmado)
   throw new Error('Falta aprovação válida ou pagamento efetivamente confirmado.');
  const certificados=academyGestaoRows_('CERTIFICADOS').filter(x=>String(x[1])===id&&String(x[4])!=='DEMO');
  if(certificados.length)throw new Error('Já existe registro de certificação não demonstrativa.');
  const audit=academyGestaoSheet_('AUDITORIA');
  if(academyGestaoRows_('AUDITORIA').some(x=>String(x[2])===id&&String(x[3])==='AUTORIZACAO_EMISSAO'))
   throw new Error('Emissão já autorizada para este protocolo.');
  const reference='AUT-'+Utilities.getUuid();
  audit.appendRow(['AUD-'+Utilities.getUuid(),'SOLICITACOES',id,'AUTORIZACAO_EMISSAO',admin,new Date(),JSON.stringify({referencia:reference,emissaoAutomatica:false})]);
  return {sucesso:true,referencia:reference,mensagem:'Autorização registrada na auditoria. A emissão definitiva continua desativada.'};
 }finally{lock.releaseLock()}
}
