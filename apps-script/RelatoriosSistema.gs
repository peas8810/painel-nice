/** Relatórios completos de certificação. Exclusivo da operação administrativa. */
function niceCertReportsAdmin_(p){
  niceCertDashboardRequireAdmin_(String(p&&p.admin_key||'').trim());
  const out=niceCertDashboardPublic_();
  const ss=SpreadsheetApp.openById(NICE_API.SPREADSHEET_ID),sh=ss.getSheetByName('CERT_EMISSOES');
  const persons={};
  if(sh&&sh.getLastRow()>1){
    const values=sh.getDataRange().getValues(),h=niceApiMapHeaders_(values[0]);
    for(let i=1;i<values.length;i++){
      const code=String(niceApiCell_(values[i],h,'CODIGO')||'').trim().toUpperCase();if(!code)continue;
      persons[code]={nome:niceApiPublicText_(niceApiCell_(values[i],h,'NOME')),email:String(niceApiCell_(values[i],h,'EMAIL')||'').trim()};
    }
  }
  out.certificates=out.certificates.map(c=>Object.assign({},c,persons[c.codigo]||{}));
  out.access='ADMIN';out.privacy='Dados pessoais restritos à sessão administrativa.';
  return out;
}
