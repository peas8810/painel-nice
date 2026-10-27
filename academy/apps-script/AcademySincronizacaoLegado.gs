/** Protocolo Academy — importação de leitura da planilha privada ao painel integrado.
 * COPIAR ao Apps Script privado. Requer AcademyGestao.gs e propriedades:
 * ACADEMY_SUPABASE_URL e ACADEMY_SUPABASE_SECRET_KEY (service_role LEGACY).
 * Nunca compartilhar o segredo ou publicar em JavaScript no site.
 * A sincronização não libera aprovações, cobranças ou emissão.
 */
function academySincronizarProtocolosLegados(){
  academyGestaoAuth_();
  const cfg=academyGestaoConfigSupabase_();
  if(!cfg)throw new Error('Configure ACADEMY_SUPABASE_URL e ACADEMY_SUPABASE_SECRET_KEY nas propriedades privadas do Apps Script.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try{
    const alunos=new Map(academyGestaoRows_('ALUNOS').map(r=>[String(r[0]),String(r[1]||'Não identificado')]));
    const evi=academyGestaoRows_('EVIDENCIAS');
    const pagamentos=academyGestaoRows_('PAGAMENTOS');
    const items=academyGestaoRows_('SOLICITACOES').filter(r=>String(r[0]||'').trim()).map(r=>{
      const id=String(r[0]);
      const matching=pagamentos.filter(p=>String(p[1])===id);
      const last=matching.length?matching[matching.length-1]:null;
      return {
        id,
        student_name:alunos.get(String(r[1]))||'Não identificado',
        activity:String(r[2]||''),
        activity_type:String(r[3]||''),
        declared_hours:Number(r[7])||0,
        verified_hours:Number(r[8])||0,
        status:String(r[10]||''),
        evidence_count:evi.filter(x=>String(x[1])===id).length,
        payment_status:last?String(last[6]||'NAO_INICIADO'):'NAO_INICIADO',
        updated_at:new Date().toISOString(),
        source:'GOOGLE_SHEETS'
      };
    });
    for(let start=0;start<items.length;start+=50){
      const batch=items.slice(start,start+50);
      const response=UrlFetchApp.fetch(cfg.url+'/rest/v1/academy_legacy_protocols?on_conflict=id',{
        method:'post',muteHttpExceptions:true,contentType:'application/json',
        headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,Prefer:'resolution=merge-duplicates,return=minimal'},
        payload:JSON.stringify(batch)
      });
      if(response.getResponseCode()<200||response.getResponseCode()>=300)
        throw new Error('Falha na sincronização HTTP '+response.getResponseCode()+': '+response.getContentText().slice(0,250));
    }
    return {sincronizados:items.length,mensagem:'Espelho administrativo atualizado no Supabase. Registros de origem permanecem na planilha privada.'};
  }finally{lock.releaseLock()}
}
