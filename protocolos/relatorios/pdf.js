(function(root){
  'use strict';
  async function build(snapshot){
    const {PDFDocument,StandardFonts,rgb}=root.PDFLib,M=root.NiceCourseReports;
    const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const W=595.28,H=841.89,margin=43,width=W-2*margin,navy=rgb(.09,.21,.36),gray=rgb(.35,.41,.47),pale=rgb(.95,.97,.98),line=rgb(.85,.89,.92);
    let page,y;
    const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'');
    function newPage(title){page=pdf.addPage([W,H]);y=H-margin;if(title)heading(title);}
    function ensure(height){if(y-height<margin+22)newPage();}
    function lines(text,size,maxWidth,face=font){
      const result=[];
      for(const paragraph of clean(text).split('\n')){
        let current='';
        for(const word of paragraph.split(/\s+/)){
          if(face.widthOfTextAtSize((current?current+' ':'')+word,size)<=maxWidth)current+=(current?' ':'')+word;
          else{
            if(current)result.push(current);current='';
            for(const char of word){if(face.widthOfTextAtSize(current+char,size)>maxWidth){result.push(current);current='';}current+=char;}
          }
        }
        result.push(current);
      }
      return result;
    }
    function text(content,{size=10,color=gray,face=font,gap=8}={}){
      for(const str of lines(content,size,width,face)){ensure(size*1.4);page.drawText(str,{x:margin,y:y-size,size,font:face,color});y-=size*1.4;}
      y-=gap;
    }
    function heading(label){ensure(36);text(label,{size:17,color:navy,face:bold,gap:12});}
    function section(label){ensure(52);y-=10;text(label,{size:12,color:navy,face:bold,gap:9});}
    function table(headers,rows,widths){
      const sizes=widths||headers.map(()=>width/headers.length);
      function draw(row,isHeader){
        const size=isHeader?8.5:8,face=isHeader?bold:font,cellLines=row.map((v,i)=>lines(v,size,sizes[i]-12,face)),height=Math.max(...cellLines.map(v=>v.length))*11+13;
        if(y-height<margin+22){newPage();if(!isHeader)draw(headers,true);}
        let x=margin;
        row.forEach((value,i)=>{
          page.drawRectangle({x,y:y-height,width:sizes[i],height,color:isHeader?navy:rgb(1,1,1),borderColor:line,borderWidth:.35});
          cellLines[i].forEach((str,j)=>page.drawText(str,{x:x+6,y:y-11-j*11,size,font:face,color:isHeader?rgb(1,1,1):gray}));x+=sizes[i];
        });y-=height;
      }
      draw(headers,true);rows.forEach(row=>draw(row,false));y-=13;
    }
    const s=snapshot.summary,r=snapshot.records,h=snapshot.history,f=snapshot.filters,F=new Intl.NumberFormat('pt-BR'),generated=new Date();
    newPage('Relatório de extensão e desenvolvimento comunitário');
    text('NICE - AlfaUnipac',{size:12,color:navy});
    text('Campus / unidade: '+(f.unit||'Todos')+'\nCurso: '+(f.course||'Todos')+'\nAno: '+(f.year||'Todos os anos'));
    text('Gerado em '+generated.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília).\nHistórico até 17/11/2026. Fonte de protocolos: '+(snapshot.updatedAt?new Date(snapshot.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'indisponível'));
    if(snapshot.warning)text('Condição da fonte. '+snapshot.warning,{color:rgb(.55,.3,.1)});
    section('Síntese do recorte');
    text(`O recorte reúne ${F.format(s.total)} registros de formalização e ${F.format(s.protocols)} identificadores NICE. Há ${F.format(s.closed)} formalizações com ao menos um protocolo finalizado. Os documentos e movimentações associados aos novos protocolos são incorporados pela sincronização do portal.`);
    table(['Indicador','Valor','Interpretação'],[
      ['Registros distintos',F.format(s.total),'Formalizações após reconciliação administrativa'],['Protocolos NICE',F.format(s.protocols),'Identificadores vinculados às formalizações'],['Ações com finalização',F.format(s.closed),'Encerramento administrativo'],['Público previsto',s.expectedN?F.format(s.expected):'ND',`Planejamento informado em ${s.expectedN} registros`]
    ],[175,75,width-250]);
    text('O público previsto representa planejamento e pode conter as mesmas pessoas em ações diferentes. Resultados comunitários dependem de evidências de execução e medidas antes e depois da intervenção. ND indica dado ausente ou insuficiente.');
    section('Escopo documental');text('O histórico foi reconciliado a partir das planilhas originais. Protocolos associados à mesma formalização são agrupados. Registros históricos sem vínculo NICE mantêm um identificador analítico. Os registros com indício de teste e os campos sem identificação conservam sua sinalização para revisão.');
    newPage('Distribuição das ações');
    section('Por campus ou unidade');table(['Campus ou unidade','Registros'],s.units.map(([name,n])=>[name,F.format(n)]),[width-90,90]);
    section('Por curso');table(['Curso','Registros'],s.courses.map(([name,n])=>[name,F.format(n)]),[width-90,90]);
    text('Ações multicursos são atribuídas a cada curso explicitamente citado. A soma das linhas por curso pode superar o total institucional.');
    section('Evolução anual');table(['Ano','Registros'],s.years.map(([name,n])=>[name,F.format(n)]),[width-90,90]);
    newPage('Contribuição temática às ODS');
    text('A associação às ODS utiliza os temas do histórico reconciliado e os dados dos protocolos atuais. A classificação temática sugerida ou informada necessita validação institucional. O catálogo de metas orienta a escolha de indicadores locais.');
    table(['ODS','Registros','Metas de referência'],s.ods.map(([n,count])=>['ODS '+n+' - '+h.labels[n],F.format(count),h.targets[n]||'Validar meta']),[320,65,width-385]);
    section('Indicadores para demonstrar resultados');
    table(['Dimensão','Medida proposta'],[['Educação','Aprendizagem antes e depois, aplicação dos conhecimentos e seguimento'],['Saúde e autonomia','Acesso ao cuidado, encaminhamentos concluídos e instrumento adequado ao projeto'],['Direitos e inclusão','Demandas orientadas, barreiras removidas e encaminhamentos efetivados'],['Trabalho e renda','Competências aplicadas e mudança acompanhada no período'],['Ambiente e território','Práticas implantadas, cobertura e manutenção dos resultados']],[125,width-125]);
    text('Cada projeto deve informar linha de base, medida final, datas, instrumento, denominador e evidência de origem. A associação temática expressa a contribuição prevista e requer resultados medidos para demonstrar os ganhos.');
    newPage('Mapa de calor por curso e ODS');
    text('Percentual dos registros do curso com associação temática a cada ODS. Cada registro pode ter várias associações.');
    const labelWidth=155,cw=(width-labelWidth)/17,rowHeight=21;
    function heatHeader(){ensure(35);page.drawText('Curso',{x:margin,y:y-11,size:8,font:bold,color:navy});for(let i=1;i<=17;i++)page.drawText(String(i),{x:margin+labelWidth+(i-1)*cw+3,y:y-11,size:7,font:bold,color:navy});y-=22;}
    heatHeader();
    for(const [course,total]of s.courses){
      if(y-rowHeight<margin+25){newPage('Mapa de calor por curso e ODS');heatHeader();}
      const label=clean(course),short=label.length>26?label.slice(0,25)+'.':label;page.drawText(short,{x:margin,y:y-12,size:7.4,font,color:gray});
      for(let o=1;o<=17;o++){
        const n=r.filter(v=>v.courses.includes(course)&&v.ods.includes(o)).length,rate=Math.round(100*n/total),xx=margin+labelWidth+(o-1)*cw;
        page.drawRectangle({x:xx,y:y-rowHeight+2,width:cw-1,height:rowHeight-2,color:rgb(1-rate*.72/100,1-rate*.55/100,1-rate*.36/100)});
        page.drawText(String(rate),{x:xx+2,y:y-12,size:6.6,font,color:rate>75?rgb(1,1,1):navy});
      }y-=rowHeight;
    }
    y-=14;text('Escala de 0 a 100%. As categorias com poucos registros são sensíveis a cada classificação individual. A cor representa aderência temática e exige leitura conjunta com o número de casos.');
    newPage('Contexto territorial e correlações');
    const territories=Object.entries(h.municipal).filter(([u])=>r.some(v=>v.unit===u));
    section('Índices municipais de 2010');
    table(['Município','Registros','IDHM','Educação','Renda'],territories.map(([u,t])=>[u,String(r.filter(v=>v.unit===u).length),t.idhm.toFixed(3),t.educacao.toFixed(3),t.renda.toFixed(3)]),[185,75,75,85,width-420]);
    if(!territories.length)text('ND. O recorte requer identificação municipal e índice territorial correspondente.');
    text('Os índices do PNUD caracterizam o município da unidade e têm referência em 2010. O local dos beneficiários deve ser registrado separadamente. O volume de ações e o encerramento administrativo precisam de medidas de resultado para análise dos ganhos comunitários.');
    section('Correlação de Spearman');
    const features=[['Ano',v=>v.year],['ODS',v=>v.ods.length],['Público previsto',v=>v.expected]];
    table(['Variável',...features.map(v=>v[0])],features.map(([name,left])=>[name,...features.map(([,right])=>{const c=M.spearman(r,left,right);return (c.value===null?'ND':c.value.toFixed(2))+' (n='+c.n+')';})]),[140,...Array(3).fill((width-140)/3)]);
    text('O tamanho da amostra válida aparece em cada par. ND indica dados insuficientes ou ausência de variação. Associações entre características de cadastro são exploratórias e podem refletir o próprio preenchimento dos formulários.');
    section('Ganhos comunitários a aferir');table(['Relação','Situação'],[['Ações e ganho educacional','ND - medidas pareadas de resultado pendentes'],['Ações e ganho em saúde','ND - medidas pareadas de resultado pendentes'],['Ações e ganho econômico','ND - medidas pareadas de resultado pendentes']],[250,width-250]);
    newPage('Ações com vínculo NICE');
    text('Todas as formalizações com protocolos do recorte estão incluídas abaixo, independentemente da paginação exibida no dashboard. Os vários identificadores de uma formalização aparecem no mesmo registro.');
    const linked=r.filter(v=>v.protocols.length);
    if(!linked.length)text('Nenhuma formalização com vínculo NICE neste recorte.');
    for(const row of linked){
      ensure(125);section(row.titles.join(' / ')||row.type||row.id);
      text(row.id+' | '+row.protocols.join(', ')+'\n'+row.courses.join(', ')+' | '+row.unit+' | '+(row.year||'Sem data'),{size:9});
      text('ODS associadas: '+(row.ods.join(', ')||'ND')+'. Público previsto: '+(Number.isFinite(row.expected)?F.format(row.expected):'ND')+'.');
      text('Situação: '+row.protocols.map(id=>id+' '+(row.states[id]|| (row.closed_protocols.includes(id)?'FINALIZADO':'situação anterior'))).join('; '),{size:9});
      if(row.placeholder)text('Registro com indício de teste. Revisão cadastral necessária.');
    }
    newPage('Rastreabilidade de todos os registros');
    text('A relação a seguir inclui o histórico e os protocolos atuais do recorte. Os identificadores ACAO referem-se à reconciliação histórica de 17/11/2026. Os novos registros usam o identificador NICE.');
    table(['Registro','Ano','Curso','Campus / unidade','ODS'],r.map(v=>[v.id,String(v.year||'ND'),v.courses.join(', '),v.unit,v.ods.join(', ')||'ND']),[95,35,145,150,width-425]);
    newPage('Recomendações e referências');
    text('Definir indicadores específicos por projeto, coletar uma linha de base e acompanhar os resultados após a ação. Registrar participantes únicos, participações, custos efetivos e devolutiva da comunidade. Validar as associações às ODS e as evidências antes da publicação de conclusões sobre benefícios.');
    text('Fonte institucional. Histórico reconciliado das planilhas NICE e fonte pública de protocolos sincronizados. A versão do histórico é '+h.as_of+'. A data da fonte atual consta na abertura deste relatório.');
    text('ONU - Objetivos de Desenvolvimento Sustentável\nhttps://sdgs.un.org/goals\nONU - Metadados dos indicadores\nhttps://unstats.un.org/sdgs/metadata/\nPNUD - IDHM municipal de 2010\nhttps://www.undp.org/pt/brazil/idhm-municipios-2010');
    const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText('NICE - AlfaUnipac | '+(i+1)+' / '+pages.length,{x:margin,y:23,size:8,font,color:gray}));
    pdf.setTitle('Relatório NICE - '+(f.course||'Geral')+' - '+(f.unit||'Todas as unidades'));pdf.setAuthor('NICE - AlfaUnipac');pdf.setCreationDate(generated);
    return pdf.save();
  }
  root.NiceCoursePDF={build};
})(typeof window!=='undefined'?window:globalThis);
