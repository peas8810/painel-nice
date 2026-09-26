/**
 * PACOTE DE ATUALIZAÇÃO NICE — 26/09/2026
 *
 * Execute APENAS depois de substituir/criar todos os arquivos listados no
 * PACOTE_ATUALIZACAO_2026-09-26.md.
 *
 * Esta rotina não duplica regras do sistema. Ela apenas atualiza estruturas,
 * gatilhos e executa reparos necessários nas bases existentes.
 */
function aplicarPacoteAtualizacaoNICE(){
  const etapas=[];
  const run=(nome,fn)=>{
    try{fn();etapas.push('OK — '+nome)}
    catch(e){etapas.push('ERRO — '+nome+': '+String(e&&e.message||e))}
  };

  run('Estrutura de Protocolos',()=>{
    const ss=niceMaster_();
    niceSheet_(ss,NICE.CONTROLE,NICE.HEADERS);
    niceSheet_(ss,NICE.HISTORICO,['DATA_HORA','ID_NICE','STATUS_ANTERIOR','STATUS_NOVO','ORIGEM','USUARIO','OBSERVACAO']);
    niceSheet_(ss,NICE.LOG,['DATA_HORA','NIVEL','ROTINA','ID_NICE','MENSAGEM']);
  });

  run('Gatilhos de Protocolos',()=>instalarGatilhosNICE());

  run('Estrutura de Certificados',()=>{
    const ss=niceMaster_();
    niceCertSheet_(ss,NICE_CERT.EVENTOS,NICE_CERT.EVENT_HEADERS);
    niceCertSheet_(ss,NICE_CERT.EMISSOES,NICE_CERT.ISSUE_HEADERS);
    niceCertSheet_(ss,NICE_CERT.LOG,NICE_CERT.LOG_HEADERS);
  });

  run('Livro Digital de Certificações',()=>instalarLivroDigitalCertificacoes());

  run('Certificados Customizados',()=>instalarCertificadosCustomizados());

  run('Painel Administrativo',()=>instalarPainelAdminCertificados());

  // Corrige protocolos antigos que ficaram sem responsável.
  run('Reparo de responsáveis vazios',()=>corrigirResponsaveisVaziosNICE());

  try{
    SpreadsheetApp.getUi().alert(
      'Pacote de atualização concluído.\n\n'+etapas.join('\n')+
      '\n\nDepois publique uma NOVA VERSÃO do Web App.'
    );
  }catch(_){}
  return etapas;
}
