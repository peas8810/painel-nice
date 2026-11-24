(function(root){
  'use strict';
  function day(value){
    if(!value||typeof value!=='string')return null;
    const s=value.trim(),iso=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if(!iso)return null;
    const [y,m,d]=iso.slice(1).map(Number),check=new Date(Date.UTC(y,m-1,d));
    if(y<1900||y>2100||check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
    if(s.includes('T')&&/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)){
      const date=new Date(s);if(Number.isNaN(date.getTime()))return null;
      const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
      const get=t=>parts.find(p=>p.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');
    }
    return iso[1]+'-'+iso[2]+'-'+iso[3];
  }
  function today(){return day(new Date().toISOString());}
  function originalDay(row){
    const original=day(row.original_protocol_date);
    if(original)return original;
    return Object.values(row.protocol_details||{}).map(d=>day(d.data_protocolo)).filter(Boolean).sort()[0]||null;
  }
  function receipt(row){
    const ids=row.protocols||[],details=ids.map(id=>row.protocol_details?.[id]);
    const known=details.filter(d=>d&&(!d.relatorio_verificacao_status||d.relatorio_verificacao_status==='confirmado')&&typeof d.relatorio_recebido==='boolean');
    const positives=known.filter(d=>d.relatorio_recebido===true);
    if(positives.length)return {received:true,date:positives.map(d=>day(d.data_relatorio)).filter(Boolean).sort()[0]||null};
    return {received:ids.length>0&&known.length===ids.length?false:null,date:null};
  }
  function classify(row,policy={},asOf=today()){
    const date=originalDay(row),cutoff=day(policy.effective_from),end=day(asOf),received=receipt(row);
    const statuses=Object.values(row.states||{}),cancelled=Boolean(statuses.length&&statuses.every(s=>s==='CANCELADO'));
    const excluded=row.placeholder?'teste':cancelled&&policy.cancelled_exempt!==false?'cancelado':null;
    const result={id:row.id,courses:row.courses||[],date,cohort:!date||!cutoff?'unclassified':date<cutoff?'historical':'current',
      administrativeClosed:Boolean(row.closed_protocols?.length),received:received.received,receivedDate:received.date,deadline:null,excluded,state:'verify',eligible:false,onTime:null};
    if(!cutoff){result.reason='Marco institucional não configurado';return result;}
    if(!date){result.reason='Data original não identificada';return result;}
    if(result.cohort==='historical'){result.state='historical';result.reason='Histórico anterior à exigência; ausência de relatório não é pendência';return result;}
    if(excluded){result.state='exempt';result.reason=excluded==='teste'?'Registro de teste fora do cálculo de cumprimento':'Ação cancelada sem exigência de relatório nesta política';return result;}
    const deadlines=[...new Set(Object.values(row.protocol_details||{}).map(d=>day(d.prazo_relatorio)).filter(Boolean))];
    if(deadlines.length!==1){result.reason=deadlines.length?'Prazos divergentes entre os protocolos da mesma formalização':'Prazo de entrega não identificado';return result;}
    result.deadline=deadlines[0];
    if(!end){result.reason='Data da avaliação não identificada';return result;}
    if(result.deadline>=end){result.state=received.received===true?'received_before_due':'not_due';result.reason='Prazo ainda não vencido; fora do denominador';return result;}
    result.eligible=true;
    result.state=received.received===true?'received':received.received===false?'pending':'verify_receipt';
    result.reason=received.received===true?'Recebimento registrado na fonte':received.received===false?'Relatório obrigatório não recebido na última consulta confirmada':'Recebimento ainda não apurado na fonte';
    if(received.received===true&&received.date)result.onTime=received.date<=result.deadline;
    return result;
  }
  function summarize(details,configured){
    const eligible=details.filter(d=>d.eligible),unknown=eligible.filter(d=>d.received===null).length,received=eligible.filter(d=>d.received===true).length;
    return {total:details.length,historical:details.filter(d=>d.cohort==='historical').length,current:details.filter(d=>d.cohort==='current').length,
      unclassified:details.filter(d=>d.cohort==='unclassified').length,excluded:details.filter(d=>d.cohort==='current'&&d.excluded).length,
      eligible:eligible.length,received,pending:eligible.filter(d=>d.received===false).length,unknown,
      notDue:details.filter(d=>['not_due','received_before_due'].includes(d.state)).length,
      missingDeadline:details.filter(d=>d.cohort==='current'&&!d.excluded&&d.deadline===null).length,
      administrativeClosed:details.filter(d=>d.administrativeClosed).length,
      documentaryReceived:details.filter(d=>d.received===true).length,
      documentaryUnknown:details.filter(d=>d.received===null).length,
      rate:configured&&eligible.length&&!unknown?100*received/eligible.length:null,
      rateLabel:!configured?'Marco pendente':!eligible.length?'Não aplicável':unknown?'Não apurado — recebimentos a verificar':null};
  }
  function analyze(rows,policy={},asOf=today()){
    const configured=Boolean(day(policy.effective_from)),details=rows.map(row=>classify(row,policy,asOf));
    const names=[...new Set(rows.flatMap(r=>r.courses||[]))];
    return {configured,cutoff:day(policy.effective_from),reference:policy.reference||'',asOf,
      ...summarize(details,configured),details,courses:names.map(course=>({course,...summarize(details.filter(d=>d.courses.includes(course)),configured)}))};
  }
  function rateText(stats){return stats.rate===null?stats.rateLabel:new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(stats.rate)+'%';}
  function paragraphs(stats){
    if(!stats)return ['A avaliação de cumprimento do fluxo está indisponível. A produção histórica permanece contabilizada.'];
    const F=new Intl.NumberFormat('pt-BR'),n=v=>F.format(v);
    if(!stats.configured)return [
      'A data oficial de início da obrigatoriedade ainda não foi configurada. A classificação histórica e a taxa de cumprimento permanecem a verificar; nenhum registro foi tratado como inadimplente com base em uma data presumida.',
      `As ${n(stats.total)} formalizações deste recorte continuam nos cálculos de produção e nas análises temáticas. Taxas e pendências de entrega não foram presumidas enquanto o marco institucional não for confirmado.`,
      'Encerramento administrativo, recebimento de documento e resultado comunitário são informações distintas. A ausência de documento em um registro antigo não é evidência de inadimplência.'
    ];
    return [
      stats.configured?`O marco de obrigatoriedade é ${stats.cutoff.split('-').reverse().join('/')}. A classificação considera a data original da formalização, nunca a data de importação. Neste recorte há ${n(stats.historical)} registros anteriores à exigência, ${n(stats.current)} posteriores ou iguais ao marco e ${n(stats.unclassified)} com data a verificar.`:'A data oficial de início da obrigatoriedade ainda não foi configurada. A classificação histórica e a taxa de cumprimento permanecem a verificar; nenhum registro foi tratado como inadimplente com base em uma data presumida.',
      'Toda a produção histórica permanece nos totais, nas distribuições e nas análises temáticas. A ausência de documento final em registros anteriores à exigência não é considerada pendência. Encerramento administrativo, recebimento do documento e resultado comunitário são informações distintas.',
      `A taxa de entrega utiliza somente formalizações posteriores ao marco, com relatório exigível e prazo já vencido na data da avaliação (${stats.asOf.split('-').reverse().join('/')}). Numerador e denominador pertencem ao mesmo conjunto: ${n(stats.received)} entregas confirmadas em ${n(stats.eligible)} formalizações exigíveis. Taxa: ${rateText(stats)}. Há ${n(stats.pending)} pendências confirmadas e ${n(stats.unknown)} recebimentos ainda não apurados nesse conjunto.`,
      `Ficam fora do denominador ${n(stats.notDue)} formalizações com prazo ainda aberto, ${n(stats.excluded)} registros excluídos pela política (cancelamentos ou testes) e ${n(stats.missingDeadline)} com prazo ausente ou divergente. Datas desconhecidas são encaminhadas para verificação. Valores não apurados não são substituídos por zero.`
    ];
  }
  const api={day,today,originalDay,receipt,classify,analyze,rateText,paragraphs};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.NiceReportCompliance=api;
})(typeof window!=='undefined'?window:globalThis);
