(function(root){
  'use strict';
  const M=root.NiceCourseReports||(typeof require==='function'?require('./model.js'):null);
  const F=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
  const number=n=>F.format(n),pct=(a,b)=>b?number(100*a/b)+'%':'ND';
  const focus={
    'Administração':'organização de iniciativas comunitárias, gestão de recursos e fortalecimento da capacidade de planejamento',
    'Agronomia':'produção agrícola, manejo responsável e articulação entre conhecimento técnico e realidade rural',
    'Arquitetura e Urbanismo':'qualidade dos espaços, acessibilidade e compreensão das necessidades do território',
    'Ciências Contábeis':'educação financeira, organização contábil e compreensão das obrigações de pessoas e organizações',
    'Direito':'acesso à informação jurídica, compreensão de direitos e orientação para os serviços competentes',
    'Educação Física':'educação para o movimento, participação em práticas corporais e promoção da vida ativa',
    'Enfermagem':'educação em saúde, prevenção e orientação para o acesso à rede de cuidados',
    'Engenharia Civil':'segurança das construções, infraestrutura e soluções técnicas adequadas às necessidades locais',
    'Estética e Cosmética':'educação para práticas seguras de cuidado, autocuidado e qualificação profissional',
    'Farmácia':'educação sobre medicamentos, uso responsável e orientação em saúde',
    'Fisioterapia':'funcionalidade, prevenção de limitações e orientação para a autonomia nas atividades diárias',
    'Fonoaudiologia':'comunicação humana, acessibilidade comunicacional e orientação sobre cuidados fonoaudiológicos',
    'Gestão Pública':'participação social, compreensão das políticas públicas e articulação dos serviços locais',
    'Medicina':'educação em saúde, prevenção e compreensão dos caminhos de acesso ao cuidado',
    'Nutrição':'educação alimentar, segurança alimentar e compreensão de práticas alimentares adequadas',
    'Odontologia':'educação em saúde bucal, prevenção e orientação para o cuidado odontológico',
    'Pedagogia':'aprendizagem, inclusão educacional e aproximação entre instituição, escola e comunidade',
    'Psicologia':'educação em saúde mental, acolhimento e orientação para as redes de apoio',
    'Serviço Social':'acesso a direitos, proteção social e orientação para as redes de atendimento',
    'Sistemas de Informação':'inclusão digital, uso de tecnologias e solução de necessidades informacionais',
    'Terapia Ocupacional':'participação social, acessibilidade e autonomia nas ocupações do cotidiano',
    'Endodontia':'educação em saúde bucal e qualificação do cuidado relacionado à preservação dentária',
    'Técnico em Vendas':'qualificação profissional, comunicação e organização das atividades comerciais',
    'Técnico em Análises Clínicas':'educação sobre exames, qualidade das práticas laboratoriais e orientação em saúde'
  };
  const domains={
    1:['acesso à proteção social','encaminhamentos efetivados e barreiras de acesso removidas'],
    2:['segurança alimentar e educação nutricional','mudança de conhecimentos e práticas alimentares acompanhadas'],
    3:['prevenção e promoção da saúde','aprendizagem, adesão às orientações e encaminhamentos concluídos'],
    4:['aprendizagem e acesso ao conhecimento','desempenho antes e depois da atividade e aplicação posterior do aprendizado'],
    5:['equidade de gênero','participação dos públicos atendidos e acesso aos serviços ou direitos trabalhados'],
    6:['uso responsável da água e saneamento','práticas implantadas e condições de acesso acompanhadas'],
    7:['educação para energia e eficiência','consumo medido e adoção das práticas propostas'],
    8:['qualificação e oportunidades de trabalho','competências aplicadas e trajetórias de trabalho acompanhadas'],
    9:['acesso e aplicação de tecnologia','uso das soluções e resolução das necessidades identificadas'],
    10:['inclusão e redução de barreiras','acessibilidade, participação e acesso efetivo aos serviços'],
    11:['qualidade dos espaços e da vida comunitária','melhorias implantadas e utilização pela comunidade'],
    12:['práticas responsáveis de produção e consumo','resíduos evitados e mudanças de práticas documentadas'],
    13:['educação e ação climática','práticas adotadas e indicadores ambientais acompanhados'],
    14:['conservação dos ambientes aquáticos','ações de conservação implantadas e condições ambientais observadas'],
    15:['conservação dos ecossistemas terrestres','áreas ou práticas de conservação mantidas no período'],
    16:['cidadania e acesso a direitos','demandas orientadas e encaminhamentos efetivados'],
    17:['cooperação entre instituições e comunidade','compromissos executados e continuidade das parcerias']
  };
  // Only controlled labels are published; source descriptions and personal data remain private.
  const themes={
    oral:['Saúde bucal',/saude bucal|higiene bucal|escovacao|carie|dentari/,'ampliar o conhecimento sobre prevenção e cuidados bucais','conhecimento antes e depois e adoção orientada de práticas de higiene'],
    medicine:['Uso de medicamentos',/medicament|automedicacao|farmacoter/,'favorecer a compreensão do uso responsável de medicamentos','compreensão das orientações e dúvidas resolvidas com encaminhamento adequado'],
    nutrition:['Alimentação e nutrição',/alimentacao|nutricional|nutricao|habitos alimentares/,'apoiar escolhas alimentares informadas e adequadas ao contexto local','aprendizagem e práticas alimentares acompanhadas'],
    breastfeeding:['Aleitamento e cuidado materno-infantil',/aleitamento|amamentacao|materno.infantil|gestante/,'ampliar o acesso a informações sobre cuidado materno-infantil','compreensão das orientações e acesso aos serviços de referência'],
    mental:['Saúde mental',/saude mental|ansiedade|depressao|sofrimento psiquico|setembro amarelo/,'qualificar a informação sobre saúde mental e as redes de apoio','aprendizagem, procura orientada por apoio e encaminhamentos concluídos'],
    chronic:['Prevenção de condições crônicas',/diabetes|hipertensao|doencas cronicas|pressao arterial/,'apoiar a compreensão de fatores de risco e caminhos de cuidado','entendimento das orientações e seguimento dos encaminhamentos'],
    infection:['Prevenção de infecções',/infecc|dengue|vacinacao|imunizacao|\bist\b|\bhiv\b|covid/,'disseminar informações de prevenção e acesso ao cuidado','conhecimento e adoção das práticas preventivas trabalhadas'],
    emergency:['Primeiros socorros',/primeiros socorros|ressuscitacao|reanimacao|engasgo/,'ampliar o preparo para reconhecer situações de urgência e procurar ajuda','desempenho em situações simuladas e retenção do aprendizado'],
    physical:['Movimento e atividade física',/atividade fisica|praticas corporais|esport|sedentarismo|exercicio fisico/,'estimular a participação informada em práticas corporais','participação efetiva e continuidade da prática acompanhada'],
    mobility:['Funcionalidade e autonomia',/mobilidade|funcionalidade|reabilitacao|autonomia funcional|prevencao de quedas/,'apoiar a autonomia e a compreensão de barreiras nas atividades cotidianas','funcionalidade avaliada com instrumento adequado e barreiras removidas'],
    communication:['Comunicação e linguagem',/linguagem|comunicacao humana|fonoaudiolog|audicao|surdez|libras/,'favorecer a comunicação e a compreensão da acessibilidade comunicacional','participação comunicativa e acesso às orientações ou encaminhamentos'],
    literacy:['Leitura, escrita e aprendizagem',/alfabetiz|letramento|leitura|aprendizagem|jogos pedagogicos/,'aproximar os participantes de experiências de aprendizagem','habilidades trabalhadas antes e depois e aplicação do aprendizado'],
    inclusion:['Inclusão e acessibilidade',/acessibilidade|inclusao|deficiencia|autismo|\btea\b/,'identificar barreiras e apoiar condições de participação','barreiras identificadas e removidas e participação dos públicos envolvidos'],
    rights:['Direitos e cidadania',/cidadania|direitos humanos|acesso a justica|direitos do consumidor|direitos sociais/,'ampliar a compreensão de direitos e dos serviços disponíveis','demandas orientadas e encaminhamentos efetivamente concluídos'],
    violence:['Prevenção da violência',/violencia|bullying|assedio|abuso sexual/,'favorecer informação sobre prevenção e redes de proteção','compreensão dos caminhos de proteção e encaminhamentos acompanhados'],
    gender:['Equidade e saúde da mulher',/saude da mulher|equidade de genero|igualdade de genero|outubro rosa/,'ampliar o acesso a informação e a oportunidades de cuidado e participação','acesso às orientações, serviços e ações de acompanhamento'],
    finance:['Educação financeira',/educacao financeira|financas|orcamento familiar|endividamento/,'fortalecer a compreensão do planejamento financeiro','conhecimento e aplicação de práticas de organização financeira'],
    business:['Empreendedorismo e gestão',/empreendedor|gestao de negocios|plano de negocios|microempreend/,'apoiar a organização de iniciativas e a qualificação da gestão','planos elaborados e práticas de gestão aplicadas posteriormente'],
    work:['Trabalho e qualificação',/empregabilidade|qualificacao profissional|mercado de trabalho|curriculo profissional/,'aproximar os participantes de informações e competências para o trabalho','competências demonstradas e trajetórias acompanhadas'],
    digital:['Tecnologia e inclusão digital',/inclusao digital|robotica|inteligencia artificial|automacao|programacao|informatica/,'facilitar a apropriação de tecnologias e a solução de necessidades locais','uso efetivo das soluções e tarefas realizadas com autonomia'],
    waste:['Resíduos e reciclagem',/recicla|residuos|coleta seletiva|reaproveitamento/,'favorecer práticas responsáveis de manejo e redução de resíduos','quantidades medidas e permanência das práticas implantadas'],
    environment:['Educação ambiental',/educacao ambiental|sustentabilidade|conservacao ambiental|biodiversidade/,'aproximar conhecimento ambiental de práticas no território','aprendizagem e mudanças de práticas mantidas no período'],
    water:['Água e saneamento',/saneamento|agua potavel|qualidade da agua|abastecimento de agua/,'qualificar a compreensão de água, saneamento e prevenção de riscos','práticas implantadas e condições de acesso verificadas'],
    buildings:['Habitação e infraestrutura',/habitacao|construcao civil|infraestrutura|patologia das construcoes|seguranca das edificacoes/,'apoiar a identificação de necessidades e alternativas técnicas no espaço construído','soluções propostas, implantadas e acompanhadas com responsáveis técnicos'],
    rural:['Produção e desenvolvimento rural',/agricultura|agricola|agroecolog|horta|manejo do solo/,'aproximar conhecimentos técnicos das práticas de produção e cuidado com o solo','práticas adotadas e resultados produtivos ou ambientais medidos'],
    culture:['Cultura e participação comunitária',/\bcultura\b|patrimonio historico|manifestacoes artisticas|musica|teatro/,'favorecer expressão, participação e valorização de saberes locais','participação efetiva e avaliação da comunidade sobre as atividades']
  };
  const formats={lecture:['Palestra',/palestra/],workshop:['Oficina',/oficina/],conversation:['Roda de conversa',/roda de conversa/],visit:['Visita',/visita/],fair:['Feira ou mostra',/feira|mostra/],campaign:['Campanha',/campanha/],training:['Curso ou capacitação',/capacitacao|minicurso|mini.curso|treinamento/],practice:['Atividade prática',/atividade pratica|aula pratica|simulacao/],guidance:['Orientação',/orientacao/]};
  const audiences={children:['Crianças',/crianca|infantil/],teenagers:['Adolescentes',/adolescent/],elderly:['Pessoas idosas',/idoso|idosa|terceira idade/],women:['Mulheres',/mulher|mulheres|gestante/],families:['Famílias',/familia/],teachers:['Educadores',/professor|educador|docente/],students:['Estudantes',/estudante|aluno|academico|discente/],workers:['Trabalhadores',/trabalhador|profissiona/],entrepreneurs:['Empreendedores',/empreendedor|empresario/],community:['Comunidade em geral',/comunidade|populacao em geral|publico em geral/]};
  function classify(source){
    const title=M.norm(source.title||source.tema||''),objective=M.norm(source.objective||''),body=M.norm([source.description,source.method,source.titulo].join(' '));
    return {themes:Object.entries(themes).map(([id,t])=>({id,score:(t[1].test(title)?4:0)+(t[1].test(objective)?2:0)+(t[1].test(body)?1:0)})).filter(v=>v.score).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3).map(v=>v.id),
      formats:Object.entries(formats).filter(([,v])=>v[1].test(M.norm([source.method,source.titulo].join(' ')))).map(([id])=>id),
      audiences:Object.entries(audiences).filter(([,v])=>v[1].test(M.norm(source.audience))).map(([id])=>id)};
  }
  function context(row){
    const live=classify({title:row.titles?.join(' '),titulo:row.type}),seed=row.context||{};
    return {themes:[...new Set([...(seed.themes||[]),...live.themes])].filter(id=>themes[id]).slice(0,3),formats:[...new Set([...(seed.formats||[]),...live.formats])].filter(id=>formats[id]),audiences:(seed.audiences||[]).filter(id=>audiences[id])};
  }
  function describeFocus(course){return focus[course]||'articulação entre formação acadêmica, demandas locais e participação da comunidade';}
  function statistics(course,universe){
    const rows=universe.filter(r=>r.courses.includes(course)),s=M.summarize(rows);
    const estimates=rows.map(r=>r.expected).filter(Number.isFinite).sort((a,b)=>a-b),n=estimates.length;
    const median=n?(n%2?estimates[(n-1)/2]:(estimates[n/2-1]+estimates[n/2])/2):null;
    return {course,rows,s,median,share:universe.length?rows.length/universe.length:null,
      position:1+M.summarize(universe).courses.filter(([,count])=>count>rows.length).length,
      correlation:M.spearman(rows,r=>r.ods.length,r=>r.expected)};
  }
  function courseNames(snapshot){return snapshot.filters.course?[snapshot.filters.course]:snapshot.summary.courses.map(([name])=>name);}
  function peers(course,universe){
    const own=universe.filter(r=>r.courses.includes(course));
    return M.summarize(universe).courses.filter(([name])=>name!==course).map(([name,total])=>{
      const common=own.filter(r=>r.courses.includes(name)).length;
      return {name,common,union:own.length+total-common,jaccard:common/(own.length+total-common)};
    }).filter(p=>p.common).sort((a,b)=>b.common-a.common||b.jaccard-a.jaccard||a.name.localeCompare(b.name,'pt-BR'));
  }
  function introduction(snapshot){
    const {summary:s,records:r}=snapshot,base=snapshot.comparisonRecords||r;
    const top=s.courses.slice(0,3).map(([name,n])=>name+' ('+number(n)+')').join(', ');
    const dated=r.map(v=>v.year).filter(Number.isFinite),years=[...new Set(dated)].sort((a,b)=>a-b);
    return [
      `Este relatório analisa a presença da extensão acadêmica no recorte selecionado a partir de ${number(s.total)} formalizações distintas, distribuídas por ${number(s.courses.length)} categorias de curso e ${number(s.units.length)} categorias de campus ou unidade. ${years.length?'Os registros datados abrangem '+years[0]+(years.length>1?' a '+years.at(-1):'')+'.':'A delimitação temporal depende da regularização das datas.'} As categorias com maior presença documental são ${top||'não identificadas'}. Esses números descrevem o acervo registrado e a capacidade de documentar iniciativas; a comprovação de benefícios depende das evidências de execução e de resultado.`,
      `O principal resultado administrativo observável é a constituição de um acervo rastreável que permite identificar ações, vínculos entre cursos e temas associados às ODS. Há ${number(s.protocols)} identificadores NICE e ${number(s.closed)} formalizações com alguma finalização administrativa, equivalentes a ${pct(s.closed,s.total)} do recorte. A ausência de finalização na fonte consultada pode decorrer de registros históricos ou de etapas ainda não informadas; ela não caracteriza, isoladamente, abandono ou insucesso da ação.`,
      s.expectedN?`O potencial de alcance informado soma ${number(s.expected)} participações previstas, com estimativas em ${number(s.expectedN)} registros (${pct(s.expectedN,s.total)} de cobertura). Esse total permite dimensionar o planejamento documentado, mas não corresponde a pessoas únicas nem a atendimentos confirmados. A parcela sem estimativa deve ser considerada ao comparar cursos, pois diferenças de preenchimento alteram os totais observados.`:'O alcance quantitativo permanece indeterminado porque não há estimativas válidas neste recorte. A ausência de informação não foi convertida em público zero.',
      `A leitura estatística por curso utiliza como referência ${number(base.length)} formalizações dos mesmos filtros de campus/unidade e ano, mantendo todos os cursos nessa base comparativa. Os capítulos individuais relacionam volume, participação no acervo, encerramento administrativo, cobertura das estimativas, evolução do registro e articulação multicursos. São comparações descritivas; elas não constituem ranking de qualidade, teste de efetividade ou estimativa causal de impacto. As contribuições comunitárias descritas adiante são hipóteses de atuação sustentadas pela área de formação e pela classificação temática disponível, cuja confirmação exige avaliação local.`
    ];
  }
  function courseAnalysis(course,snapshot){
    const base=snapshot.comparisonRecords||snapshot.records,{rows,s,median,position,correlation}=statistics(course,base);
    if(!rows.length)return [];
    const multi=rows.filter(r=>r.courses.length>1).length,links=peers(course,base),rankCount=M.summarize(base).courses.length;
    const paragraphs=[
      `A contribuição potencial de ${course} à comunidade está relacionada à ${describeFocus(course)}. No recorte de campus/unidade e ano, o curso aparece em ${number(s.total)} formalizações, correspondentes a ${pct(s.total,base.length)} dos registros distintos da base comparativa. Pelo volume documental, ocupa a posição ${position} entre ${rankCount} categorias, com empates compartilhando a mesma posição. A participação traduz presença nos registros e deve ser lida à luz do tamanho do curso, das oportunidades de atuação e da cobertura cadastral, que não foram padronizados por número de alunos.`,
      `Os ${number(s.protocols)} identificadores NICE vinculados ao curso representam ${number(s.live)} formalizações, pois uma mesma origem pode receber mais de um identificador. O encerramento administrativo consta em ${number(s.closed)} formalizações (${pct(s.closed,s.total)}). A rastreabilidade e a possibilidade de acompanhamento são ganhos observáveis de gestão; aprendizagem, melhoria de saúde, renda ou acesso a direitos precisam de medidas próprias para serem reconhecidos como resultados comunitários.`
    ];
    paragraphs.push(s.expectedN?`O planejamento declara ${number(s.expected)} participações em ${number(s.expectedN)} formalizações, com cobertura de ${pct(s.expectedN,s.total)}. Entre os registros com estimativa, a média é ${number(s.expected/s.expectedN)} e a mediana é ${number(median)} participações por formalização. A mediana ajuda a contextualizar a média quando algumas iniciativas concentram estimativas elevadas. As ações compartilhadas com outros cursos mantêm o mesmo público em cada capítulo; os valores por curso não devem ser somados como pessoas distintas.`:'Não há estimativa válida de público para este curso no recorte. Por isso, média, mediana e alcance previsto permanecem ND, e o volume de formalizações constitui apenas uma medida de atividade documentada.');
    const datedYears=s.years.filter(([year])=>/^\d{4}$/.test(year));
    if(datedYears.length){const first=datedYears[0],last=datedYears.at(-1);paragraphs.push(first[0]===last[0]?`A série do curso concentra ${number(first[1])} registros em ${first[0]}. Um único período não permite estabelecer tendência temporal.`:`Na série cadastral, ${first[0]} apresenta ${number(first[1])} registros e ${last[0]} apresenta ${number(last[1])}. A diferença entre esses extremos descreve o acervo disponível, sem ajuste de duração ou completude de cada ano. Alterações de rotina de protocolo e períodos ainda abertos precisam ser verificados antes de interpretar essa diferença como expansão ou retração da extensão.`);}
    const ods=s.ods.slice(0,3);
    const themeCounts=new Map();rows.forEach(row=>context(row).themes.forEach(id=>themeCounts.set(id,(themeCounts.get(id)||0)+1)));
    const mainThemes=[...themeCounts].sort((a,b)=>b[1]-a[1]).slice(0,3);
    if(mainThemes.length)paragraphs.push(`A leitura temática automatizada das descrições históricas e dos temas disponíveis destaca ${mainThemes.map(([id,n])=>themes[id][0]+' ('+number(n)+' formalizações)').join('; ')}. Essa caracterização torna visíveis frentes concretas do portfólio do curso. Ela identifica menções textuais, sujeitas a revisão, e não atesta que as atividades ou resultados foram realizados.`);
    paragraphs.push(ods.length?`A distribuição temática destaca ${ods.map(([o,n])=>'ODS '+o+' - '+snapshot.history.labels[o]+' ('+number(n)+' registros; '+pct(n,s.total)+')').join('; ')}. Essas associações aproximam o portfólio do curso dos temas de desenvolvimento sustentável. O ganho esperado deve ser acompanhado por indicadores locais, como ${domains[Number(ods[0][0])]?.[1]||'mudanças verificadas antes e depois da ação'}. A correspondência temática ainda exige validação institucional e não equivale ao cálculo dos indicadores oficiais da ONU.`:'Não há associação às ODS registrada ou sugerida para as ações deste curso. A vinculação deve ser validada a partir dos objetivos e evidências de cada projeto.');
    paragraphs.push(links.length?`A articulação multicursos aparece em ${number(multi)} formalizações (${pct(multi,s.total)} do acervo do curso). As maiores interseções são ${links.slice(0,5).map(p=>p.name+' ('+number(p.common)+' '+(p.common===1?'registro compartilhado':'registros compartilhados')+'; Jaccard '+pct(p.common,p.union)+')').join('; ')}. O índice de Jaccard divide as formalizações compartilhadas pela união dos acervos dos dois cursos: mede proximidade documental e oportunidades de integração, sem demonstrar efeito adicional da parceria.`:'Não foram identificadas formalizações explicitamente compartilhadas com outros cursos. Isso caracteriza o preenchimento disponível e não exclui parcerias que deixaram de ser registradas.');
    paragraphs.push(correlation.value===null?`A relação entre quantidade de ODS e público previsto é ND (n=${number(correlation.n)} pares válidos), por amostra insuficiente ou ausência de variação. Não é possível extrair uma associação numérica desse conjunto.`:`A correlação de Spearman entre quantidade de ODS associadas e público previsto é ${correlation.value.toFixed(3).replace('.',',')} (n=${number(correlation.n)} pares válidos). O coeficiente relaciona características do cadastro e do planejamento, sem representar ganhos sociais. Trata-se de análise exploratória, sem teste de significância; especialmente em amostras pequenas, a magnitude pode ser instável.`);
    const territories=Object.entries(snapshot.history.municipal).filter(([unit])=>rows.some(r=>r.unit===unit));
    if(territories.length)paragraphs.push(`O contexto territorial inclui ${territories.map(([u,t])=>u+' (IDHM de 2010: '+t.idhm.toFixed(3).replace('.',',')+')').join('; ')}. Esses índices ajudam a caracterizar o município da unidade, mas não identificam o território de todos os beneficiários. Como a base não dispõe de medidas locais de resultado antes e depois, não permite atribuir mudanças no IDHM às ações do curso.`);
    paragraphs.push(`Para demonstrar os ganhos de ${course}, a continuidade da avaliação deve combinar participantes únicos, objetivos específicos, uma medida inicial e uma medida final, além da devolutiva da comunidade. O potencial ligado à ${describeFocus(course)} poderá então ser confrontado com mudanças efetivamente observadas. No conjunto atual, a conclusão sustentada é sobre presença institucional, alcance planejado e articulação temática; a intensidade dos benefícios sociais permanece a aferir.`);
    return paragraphs;
  }
  function actionAnalysis(row,courseRows,history,comparisonCourse){
    const area=(row.ods||[]).map(o=>domains[o]).filter(Boolean),peers=courseRows||[],details=context(row);
    const n=peers.length,closed=Boolean(row.closed_protocols.length),ratio=Number.isFinite(row.expected)&&n?peers.filter(r=>Number.isFinite(r.expected)):[];
    const pool=ratio.reduce((sum,r)=>sum+r.expected,0);
    const paragraphs=[`A formalização ${row.id}, de ${row.year||'ano não identificado'}, está vinculada a ${row.courses.join(', ')} em ${row.unit}. ${row.protocols.length?'Seus '+row.protocols.length+' identificadores NICE permitem acompanhar os vínculos administrativos dessa origem.':'O identificador histórico permite localizar a origem reconciliada, sem vínculo NICE informado.'} ${closed?'Há ao menos uma finalização administrativa registrada, que documenta uma etapa do fluxo e precisa ser acompanhada das evidências de execução.':'A fonte consultada não informa finalização administrativa para esta origem; a situação de execução deve ser verificada nos documentos.'}`];
    if(row.placeholder){paragraphs.push('Este registro apresenta indício de teste e requer revisão antes de compor conclusões sobre atuação comunitária. Ele permanece visível para transparência da contagem e da rastreabilidade.');return paragraphs;}
    if(details.themes.length||details.formats.length||details.audiences.length)paragraphs.push(`A classificação automatizada das menções disponíveis sugere ${[details.themes.length?'os temas '+details.themes.map(id=>themes[id][0]).join(', '):'',details.formats.length?'os formatos '+details.formats.map(id=>formats[id][0]).join(', '):'',details.audiences.length?'os públicos '+details.audiences.map(id=>audiences[id][0]).join(', '):''].filter(Boolean).join('; ')}. ${details.themes.length?'Nessa frente, a contribuição esperada é '+themes[details.themes[0]][2]+'. O ganho pode ser investigado por '+themes[details.themes[0]][3]+'. ':''}As menções descrevem o contexto cadastral e requerem validação nos documentos da ação.`);
    paragraphs.push(area.length?`Sua associação temática a ${row.ods.map(o=>'ODS '+o+' ('+(history.labels[o]||'validar classificação')+')').join(', ')} situa a contribuição potencial em ${area.map(v=>v[0]).join('; ')}. O benefício específico desta ação ainda depende da confirmação de seus objetivos e resultados. Para verificá-lo, recomenda-se acompanhar ${area.slice(0,2).map(v=>v[1]).join('; ')}.`:`A natureza cadastrada, ${row.type||'não identificada'}, situa a iniciativa no portfólio de extensão dos cursos relacionados. Sem uma associação temática validada ou medidas de resultado, o benefício específico permanece indeterminado; a avaliação deve partir do objetivo do projeto e da mudança que a comunidade espera observar.`);
    paragraphs.push(Number.isFinite(row.expected)?`O cadastro prevê ${number(row.expected)} participações${pool>0?', equivalentes a '+pct(row.expected,pool)+' do público planejado informado no conjunto de '+number(n)+' formalizações de '+(comparisonCourse||row.courses[0])+' neste recorte':''}. É uma medida de dimensão planejada. A confirmação do ganho requer público efetivamente participante, evidências e acompanhamento dos resultados; participações previstas não permitem afirmar atendimento realizado nem pessoas únicas beneficiadas.`:'A ausência de público previsto impede dimensionar quantitativamente o alcance desta ação. O ganho comunitário permanece a aferir por indicadores de execução e resultado; a ausência de valores não foi interpretada como benefício zero.');
    return paragraphs;
  }
  const api={statistics,courseNames,peers,introduction,courseAnalysis,actionAnalysis,pct,number,classify,context,themes,formats,audiences};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.NiceCourseNarrative=api;
})(typeof window!=='undefined'?window:globalThis);
