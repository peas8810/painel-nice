(()=>{
  if(window.__NICE_UI_STARTED) return;
  window.__NICE_UI_STARTED = true;
  try {
    const RAW = JSON.parse(window.__NICE_DATA);
    const D = RAW.d;
    const AI = window.__NICE_MODEL || {clusters:{rows:[],sil:0},anom:[]};
    const F = new Intl.NumberFormat("pt-BR");
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
    const B64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

    let bytes = B64(RAW.p), view = new DataView(bytes.buffer), off = 0;
    const P = [];
    for(let i=0;i<RAW.n;i++){
      const year=2020+view.getUint8(off++);
      const type=D.type[view.getUint8(off++)];
      const course=D.course[view.getUint8(off++)];
      const mod=D.modality[view.getUint8(off++)];
      const unit=D.unit[view.getUint8(off++)];
      const reach=D.reach[view.getUint8(off++)];
      const theme=D.themeTransversal[view.getUint8(off++)];
      const inf=view.getUint16(off,true); off+=2;
      const part=view.getUint16(off,true); off+=2;
      const stud=view.getUint16(off,true); off+=2;
      const bits=view.getUint8(off++);
      const n=view.getUint8(off++);
      const people=[];
      for(let j=0;j<n;j++){ people.push(view.getUint16(off,true)); off+=2; }
      P.push({id:i+1,year,type,course,mod,unit,reach,theme,inf,part,stud,
        est:!!(bits&1),ext:!!(bits&2),partner:!!(bits&4),cert:!!(bits&8),
        lab:!!(bits&16),veh:!!(bits&32),people});
    }
    bytes=B64(RAW.r); view=new DataView(bytes.buffer); off=0;
    const R=[];
    for(let i=0;i<RAW.rn;i++){
      R.push({id:i+1,year:2020+view.getUint8(off++),
        type:D.type[view.getUint8(off++)],course:D.course[view.getUint8(off++)]});
    }
    window.__NICE_PROTOCOLS=P; window.__NICE_REPORTS=R;

    const uniq=a=>[...new Set(a.filter(v=>v!==null&&v!==undefined&&v!==""))]
      .sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
    const count=(a,k)=>{const m={};a.forEach(x=>{const z=x[k]||"Não informado";m[z]=(m[z]||0)+1});return m};
    const sumBy=(a,k,v)=>{const m={};a.forEach(x=>{const z=x[k]||"Não informado";m[z]=(m[z]||0)+(+x[v]||0)});return m};
    const top=(m,n=10)=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n);
    const pct=x=>(100*x).toFixed(1)+"%";

    function fillSelect(id, values, first="Todos"){
      const s=q("#"+id); if(!s) return;
      s.innerHTML="";
      const z=document.createElement("option"); z.value=""; z.textContent=first; s.appendChild(z);
      values.forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v;s.appendChild(o)});
    }
    fillSelect("fy",uniq(P.map(x=>x.year)).map(String));
    fillSelect("fc",uniq(P.map(x=>x.course)));
    fillSelect("ft",uniq(P.map(x=>x.type)));
    fillSelect("fm",uniq(P.map(x=>x.mod)));
    fillSelect("fu",uniq(P.map(x=>x.unit)));
    fillSelect("fr",uniq(P.map(x=>x.reach)));
    fillSelect("iy",uniq(P.map(x=>x.year)).map(String),"Todos os anos");

    function canvas(id){
      const c=q("#"+id); if(!c) return null;
      const d=window.devicePixelRatio||1, rect=c.getBoundingClientRect();
      const w=Math.max(320,rect.width), h=300;
      c.width=w*d; c.height=h*d; c.style.height=h+"px";
      const ctx=c.getContext("2d"); ctx.setTransform(d,0,0,d,0,0); ctx.clearRect(0,0,w,h);
      ctx.font="11px Segoe UI"; return {ctx,w,h};
    }
    function hbar(id, rows){
      const z=canvas(id); if(!z) return; const {ctx,w,h}=z;
      if(!rows.length){ctx.fillStyle="#64748b";ctx.fillText("Sem dados.",15,25);return}
      const max=Math.max(...rows.map(r=>r[1]),1), left=175, right=45, topm=14, bottom=18, gap=5;
      const bh=Math.max(11,(h-topm-bottom-gap*(rows.length-1))/rows.length);
      rows.forEach((r,i)=>{
        const y=topm+i*(bh+gap), bw=(w-left-right)*(r[1]/max);
        ctx.fillStyle=i===0?"#e97824":"#2f75b5"; ctx.fillRect(left,y,bw,bh);
        ctx.fillStyle="#334155";ctx.textAlign="right";ctx.textBaseline="middle";
        let label=String(r[0]); if(label.length>28) label=label.slice(0,26)+"…";
        ctx.fillText(label,left-7,y+bh/2);
        ctx.textAlign="left";ctx.fillStyle="#64748b";
        ctx.fillText(F.format(Math.round(r[1])),Math.min(w-42,left+bw+5),y+bh/2);
      });
    }
    function annual(p){
      const z=canvas("annual"); if(!z) return; const {ctx,w,h}=z;
      const years=uniq(P.map(x=>x.year)).sort(), f=currentFilters();
      const rows=years.map(y=>[y,p.filter(x=>x.year===y).length,
        R.filter(x=>x.year===y&&(!f.course||x.course===f.course)&&(!f.type||x.type===f.type)).length]);
      const max=Math.max(...rows.flatMap(r=>[r[1],r[2]]),1), left=40,right=12,topm=26,bottom=38;
      const pw=w-left-right,ph=h-topm-bottom,gw=pw/rows.length,bw=Math.min(31,gw*.28);
      rows.forEach((r,i)=>{
        const cx=left+gw*(i+.5);
        [[r[1],"#2f75b5",-bw*.56],[r[2],"#e97824",bw*.56]].forEach(v=>{
          const hh=ph*v[0]/max;ctx.fillStyle=v[1];ctx.fillRect(cx+v[2]-bw/2,topm+ph-hh,bw,hh);
        });
        ctx.fillStyle="#475569";ctx.textAlign="center";ctx.fillText(r[0],cx,h-15);
      });
      ctx.fillStyle="#2f75b5";ctx.fillRect(left,4,11,7);ctx.fillStyle="#475569";ctx.textAlign="left";ctx.fillText("Protocolos",left+16,11);
      ctx.fillStyle="#e97824";ctx.fillRect(left+86,4,11,7);ctx.fillStyle="#475569";ctx.fillText("Relatórios",left+102,11);
    }

    function currentFilters(){return{
      year:q("#fy").value,course:q("#fc").value,type:q("#ft").value,
      mod:q("#fm").value,unit:q("#fu").value,reach:q("#fr").value
    }}
    const pMatch=(x,f)=>(!f.year||String(x.year)===f.year)&&(!f.course||x.course===f.course)&&
      (!f.type||x.type===f.type)&&(!f.mod||x.mod===f.mod)&&(!f.unit||x.unit===f.unit)&&(!f.reach||x.reach===f.reach);
    const rMatch=(x,f)=>(!f.year||String(x.year)===f.year)&&(!f.course||x.course===f.course)&&(!f.type||x.type===f.type);

    function updateOverview(){
      const f=currentFilters(), p=P.filter(x=>pMatch(x,f)), r=R.filter(x=>rMatch(x,f));
      q("#kp").textContent=F.format(p.length);q("#kr").textContent=F.format(r.length);
      q("#ki").textContent=F.format(sum(p,"inf"));q("#kc").textContent=F.format(sum(p,"part"));
      q("#ks").textContent=F.format(sum(p,"stud"));
      const ppl=new Set();p.forEach(x=>x.people.forEach(z=>ppl.add(z)));q("#kd").textContent=F.format(ppl.size);
      q("#ke").textContent=F.format(p.filter(x=>x.ext).length);
      q("#kx").textContent=F.format(p.filter(x=>["Externo/comunidade","Misto (interno + externo)"].includes(x.reach)).length);
      q("#mp").textContent="Parceiros: "+F.format(p.filter(x=>x.partner).length);
      q("#mcert").textContent="Certificados: "+F.format(p.filter(x=>x.cert).length);
      q("#mlab").textContent="Lab./auditório: "+F.format(p.filter(x=>x.lab).length);
      q("#mveh").textContent="Veículo: "+F.format(p.filter(x=>x.veh).length);
      q("#mest").textContent="Participação estimada: "+F.format(p.filter(x=>x.est).length);
      annual(p); hbar("courses",top(count(p,"course"))); hbar("types",top(count(p,"type")));
      hbar("reach",top(count(p,"reach"),5)); hbar("mods",top(count(p,"mod"),5));
      hbar("parts",top(sumBy(p,"course","part")));
      const themes={};p.forEach(x=>{if(!x.theme||x.theme==="Não informado")return;x.theme.split(/[,;]/).forEach(t=>{t=t.trim();if(t)themes[t]=(themes[t]||0)+1})});
      hbar("themes",top(themes)); hbar("units",top(count(p,"unit")));
      const cs={};p.forEach(x=>{const z=cs[x.course]||(cs[x.course]={e:0,p:0,s:0,ext:0,comm:0});z.e++;z.p+=x.part;z.s+=x.stud;if(x.ext)z.ext++;if(["Externo/comunidade","Misto (interno + externo)"].includes(x.reach))z.comm++});
      const rr=count(r,"course");
      q("#tb").innerHTML=Object.entries(cs).sort((a,b)=>b[1].e-a[1].e).slice(0,35).map(([c,z])=>
        `<tr><td>${esc(c)}</td><td>${z.e}</td><td>${rr[c]||0}</td><td>${F.format(z.p)}</td><td>${F.format(z.s)}</td><td>${z.ext}</td><td>${z.comm}</td></tr>`).join("");
    }

    function courseStats(p,r){
      const out={};
      p.forEach(x=>{
        const z=out[x.course]||(out[x.course]={e:0,rep:0,ext:0,comm:0,partner:0,informed:0,cert:0});
        z.e++; if(x.ext)z.ext++; if(["Externo/comunidade","Misto (interno + externo)"].includes(x.reach))z.comm++;
        if(x.partner)z.partner++; if(!x.est)z.informed++; if(x.cert)z.cert++;
      });
      r.forEach(x=>{if(out[x.course])out[x.course].rep++});
      return out;
    }
    function iee(z){
      if(!z||!z.e)return 0;
      const doc=Math.min(z.rep/z.e,1);
      return 100*(.25*doc+.20*z.comm/z.e+.20*z.ext/z.e+.15*z.partner/z.e+.10*z.informed/z.e+.10*z.cert/z.e);
    }
    function priority(z){
      if(!z||!z.e)return 0;
      return 100*(.75*(1-Math.min(z.rep/z.e,1))+.25*Math.min(z.e/50,1));
    }
    function riskClass(x){return x>=70?["Alta","high"]:x>=45?["Moderada","med"]:["Baixa","low"]}

    function trendRows(){
      const a=count(P.filter(x=>x.year===2024),"course"), b=count(P.filter(x=>x.year===2025),"course"), rows=[];
      new Set([...Object.keys(a),...Object.keys(b)]).forEach(c=>{
        const x=a[c]||0,y=b[c]||0;if(x>=5)rows.push([c,x,y,(y-x)/x]);
      });
      return [...rows.filter(z=>z[3]>=0).sort((x,y)=>y[3]-x[3]).slice(0,5),
        ...rows.filter(z=>z[3]<0).sort((x,y)=>x[3]-y[3]).slice(0,5)];
    }
    function odsFor(x){
      const s=new Set(),t=(x.theme||"").toLowerCase(),c=(x.course||"").toLowerCase();
      if(/medicina|enfermagem|psicologia|farmácia|fisioterapia|odontologia|nutrição|biomedicina/.test(c))s.add("ODS 3 · Saúde e Bem-Estar");
      if(/pedagogia|letras|história|geografia/.test(c))s.add("ODS 4 · Educação de Qualidade");
      if(/gênero|genero/.test(t))s.add("ODS 5 · Igualdade de Gênero");
      if(/direitos humanos|étnico|etnico|racial/.test(t))s.add("ODS 10 · Redução das Desigualdades");
      if(/ambiental/.test(t)){s.add("ODS 12 · Consumo Responsável");s.add("ODS 13 · Ação Climática")}
      if(/administração|administracao|contábeis|contabeis|turismo|sistemas de informação|sistemas de informacao/.test(c))s.add("ODS 8 · Trabalho e Crescimento");
      if(/direito|serviço social|servico social/.test(c))s.add("ODS 16 · Paz, Justiça e Instituições");
      return s;
    }
    function updateIntelligence(){
      const y=q("#iy").value, p=y?P.filter(x=>String(x.year)===y):P, r=y?R.filter(x=>String(x.year)===y):R;
      const stats=courseStats(p,r), entries=Object.entries(stats).filter(([,z])=>z.e>=5).map(([c,z])=>({
        c,z,score:iee(z),prio:priority(z),doc:Math.min(z.rep/z.e,1),comm:z.comm/z.e
      }));
      const g={e:p.length,rep:r.length,ext:p.filter(x=>x.ext).length,
        comm:p.filter(x=>["Externo/comunidade","Misto (interno + externo)"].includes(x.reach)).length,
        partner:p.filter(x=>x.partner).length,informed:p.filter(x=>!x.est).length,cert:p.filter(x=>x.cert).length};
      q("#iee").textContent=Math.round(iee(g))+"/100";
      q("#doccov").textContent=p.length?pct(Math.min(r.length/p.length,1)):"0%";
      q("#docgap").textContent=F.format(Math.max(p.length-r.length,0));
      q("#community").textContent=p.length?pct(g.comm/p.length):"0%";

      const eligible=entries.filter(x=>x.z.e>=10), insights=[];
      const best=[...eligible].sort((a,b)=>b.score-a.score)[0];
      const comm=[...eligible].sort((a,b)=>b.comm-a.comm)[0];
      const doc=[...eligible].sort((a,b)=>a.doc-b.doc)[0];
      const themeTop=top(count(p.filter(x=>x.theme&&x.theme!=="Não informado"),"theme"),1)[0];
      const tr=trendRows()[0];
      if(best)insights.push(`<li><b>${esc(best.c)}</b> apresenta o maior IEE entre cursos com pelo menos 10 ações no recorte (${Math.round(best.score)}/100).</li>`);
      if(comm)insights.push(`<li><b>${esc(comm.c)}</b> possui a maior proporção de ações externas/mistas entre os cursos de maior volume (${pct(comm.comm)}).</li>`);
      if(doc)insights.push(`<li><b>${esc(doc.c)}</b> merece atenção documental: cobertura agregada de relatórios de ${pct(doc.doc)}.</li>`);
      if(themeTop)insights.push(`<li>O tema transversal mais recorrente é <b>${esc(themeTop[0])}</b>, presente em ${F.format(themeTop[1])} protocolos do recorte.</li>`);
      if(tr)insights.push(`<li>Na comparação 2024→2025, <b>${esc(tr[0])}</b> está entre os maiores crescimentos de registros (${tr[3]>=0?"+":""}${(100*tr[3]).toFixed(1)}%).</li>`);
      q("#insights").innerHTML=insights.join("")||"<li>Não há dados suficientes para gerar leitura executiva neste recorte.</li>";

      const gaps=[
        ["Participação originalmente informada",p.length?100*g.informed/p.length:0],
        ["Alcance identificado",p.length?100*p.filter(x=>x.reach!=="Não identificado").length/p.length:0],
        ["Modalidade estruturada",p.length?100*p.filter(x=>x.mod!=="Não informado").length/p.length:0],
        ["Unidade geográfica específica",p.length?100*p.filter(x=>!/(não identificada|não informada|polos|cursos técnicos|pós-graduação)/i.test(x.unit||"")).length/p.length:0],
        ["Cobertura agregada de relatórios",p.length?100*Math.min(r.length/p.length,1):0]
      ];
      q("#gaps").innerHTML=gaps.map(z=>`<div class="qrow"><span>${esc(z[0])}</span><div class="bar"><i style="width:${z[1].toFixed(1)}%"></i></div><b>${z[1].toFixed(1)}%</b></div>`).join("");

      hbar("riskbar",entries.sort((a,b)=>b.prio-a.prio).slice(0,10).map(x=>[x.c,x.prio]));
      const ods={};p.forEach(x=>odsFor(x).forEach(k=>ods[k]=(ods[k]||0)+1));hbar("odschart",top(ods,8));

      q("#ieetb").innerHTML=Object.entries(stats).filter(([,z])=>z.e>=3)
        .map(([c,z])=>({c,z,score:iee(z),prio:priority(z)})).sort((a,b)=>b.score-a.score)
        .map(x=>{const rc=riskClass(x.prio);return `<tr><td>${esc(x.c)}</td><td>${x.z.e}</td><td>${x.z.rep}</td><td>${pct(Math.min(x.z.rep/x.z.e,1))}</td><td><b>${Math.round(x.score)}</b></td><td><span class="risk ${rc[1]}">${rc[0]}</span></td><td>${pct(x.z.comm/x.z.e)}</td><td>${pct(x.z.partner/x.z.e)}</td></tr>`}).join("");

      q("#trendtb").innerHTML=trendRows().map(z=>`<tr><td>${esc(z[0])}</td><td>${z[1]}</td><td>${z[2]}</td><td class="${z[3]>=0?"pos":"neg"}">${z[3]>=0?"+":""}${(100*z[3]).toFixed(1)}%</td></tr>`).join("");

      if(AI.clusters?.rows?.length){
        const groups={};AI.clusters.rows.forEach(z=>(groups[z[1]]??=[]).push(z));
        q("#clusterCards").innerHTML=Object.entries(groups).map(([k,a])=>`<div class="cluster"><h3>Perfil ${+k+1} · ${esc(a[0][2])}</h3><p>${a.map(z=>esc(z[0])).join(", ")}</p><b>${a.length} curso(s) · clusterização exploratória</b></div>`).join("");
      } else q("#clusterCards").innerHTML='<p class="desc">Clusterização indisponível nesta versão.</p>';
      q("#atb").innerHTML=(AI.anom||[]).map(z=>`<tr><td>${z[0]}</td><td>${z[1]}</td><td>${esc(z[2])}</td><td>${esc(z[3])}</td><td>${z[4]}</td><td>${esc(z[5])}</td><td>${z[6]}</td></tr>`).join("");
    }

    ["fy","fc","ft","fm","fu","fr"].forEach(id=>q("#"+id).addEventListener("change",updateOverview));
    q("#reset").addEventListener("click",()=>{["fy","fc","ft","fm","fu","fr"].forEach(id=>q("#"+id).value="");updateOverview()});
    q("#csv").addEventListener("click",()=>{
      const p=P.filter(x=>pMatch(x,currentFilters())),cols=["id","year","course","type","mod","unit","reach","inf","part","stud","est","ext"];
      const E=v=>'"'+String(v??"").replaceAll('"','""')+'"';
      const csv=[cols.join(";"),...p.map(x=>cols.map(k=>E(x[k])).join(";"))].join("\n");
      const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download="nice_eventos_filtrado.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
    });
    q("#iy").addEventListener("change",updateIntelligence);
    qa(".tabs button").forEach(btn=>btn.addEventListener("click",()=>{
      qa(".tabs button").forEach(x=>x.classList.toggle("on",x===btn));
      qa(".tab").forEach(x=>x.classList.toggle("on",x.id===btn.dataset.tab));
      setTimeout(()=>{if(btn.dataset.tab==="visao")updateOverview();if(btn.dataset.tab==="intel")updateIntelligence()},0);
    }));
    window.addEventListener("resize",()=>{clearTimeout(window.__niceRT);window.__niceRT=setTimeout(()=>{
      if(q("#visao").classList.contains("on"))updateOverview();
      if(q("#intel").classList.contains("on"))updateIntelligence();
    },180)});

    updateOverview(); updateIntelligence();
    window.__NICE_UI_OK=true;
    console.info("NICE dashboard v12 OK",P.length,R.length);
  } catch(e) {
    window.__NICE_UI_STARTED=false;
    console.error(e);
    throw e;
  }
})();