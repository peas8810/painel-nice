function doPost(e){
  const p=(e&&e.parameter)||{};
  const action=String(p.action||'').toLowerCase();
  const transport=String(p.transport||'').toLowerCase();
  let payload;
  try{
    if(action==='cert_issue') payload=niceCertPublicIssue_(p);
    else payload={ok:false,error:'Ação não reconhecida.'};
  }catch(err){
    payload={ok:false,error:String(err&&err.message||'Falha ao processar a solicitação.')};
  }
  if(transport==='bridge') return niceApiBridgeOutput_(payload,p.request_id);
  return niceApiOutput_(payload,p.callback);
}
