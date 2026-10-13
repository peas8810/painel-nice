(()=>{
 let editor,source,container;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function init(){source=document.querySelector('[name="conteudo"]');if(!source)return false;
 source.hidden=true;container=document.createElement('div');container.className='content-editor';source.after(container);
 container.innerHTML='<div class="editor-toolbar" role="toolbar" aria-label="Formatação do conteúdo"><button type="button" data-cmd="bold"><b>Negrito</b></button><button type="button" data-cmd="italic"><i>Itálico</i></button><button type="button" data-cmd="underline"><u>Sublinhado</u></button><button type="button" data-cmd="insertUnorderedList">Lista de tópicos</button><button type="button" data-cmd="insertOrderedList">Lista numerada</button><button type="button" data-cmd="justifyLeft">Esquerda</button><button type="button" data-cmd="justifyCenter">Centro</button><button type="button" data-cmd="justifyRight">Direita</button><button type="button" data-cmd="justifyFull">Justificar</button><button type="button" data-cmd="removeFormat">Limpar formatação</button><button type="button" id="editorExpand">Tela cheia</button></div><div id="contentEditable" contenteditable="true" role="textbox" aria-label="Conteúdo programático" aria-multiline="true"></div><p class="small">Use Enter para separar parágrafos ou tópicos. Formate o texto selecionado pelos botões acima.</p>';
 editor=container.querySelector('[contenteditable]');
 container.querySelectorAll('[data-cmd]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>{editor.focus();document.execCommand(b.dataset.cmd,false,null);sync()}});
 container.querySelector('#editorExpand').onclick=()=>{container.classList.toggle('expanded');container.querySelector('#editorExpand').textContent=container.classList.contains('expanded')?'Fechar tela cheia':'Tela cheia'};
 editor.oninput=sync;editor.onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));sync()};
 editor.onkeydown=e=>{if(e.key==='Escape')container.classList.remove('expanded')};set(source.value);return true;
 }
 function read(){if(!editor)return[];const result=[];
 function paragraph(node,prefix=''){const runs=[];const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const text=n.nodeValue;if(!text)continue;const cs=getComputedStyle(n.parentElement);runs.push({texto:text,negrito:Number(cs.fontWeight)>=600||cs.fontWeight==='bold',italico:cs.fontStyle==='italic',sublinhado:cs.textDecorationLine.includes('underline')});}
 if(!runs.length)return;if(prefix)runs.unshift({texto:prefix});const text=runs.map(r=>r.texto).join('');if(!text.trim())return;const align=node.style?.textAlign||editor.style.textAlign||'';result.push({texto:text,alinhamento:({justify:'justificado',left:'esquerda',center:'centro',right:'direita'})[align]||'',runs});}
 function scan(node){if(node.nodeType===Node.TEXT_NODE){if(node.textContent.trim()){const p=document.createElement('p');p.textContent=node.textContent;paragraph(p)}return;}if(node.tagName==='UL'||node.tagName==='OL'){[...node.children].forEach((li,i)=>paragraph(li,node.tagName==='UL'?'• ':String(i+1)+'. '));return;}if([...node.children].some(n=>['P','DIV','UL','OL'].includes(n.tagName))){[...node.childNodes].forEach(scan);return;}paragraph(node);}
 [...editor.childNodes].forEach(scan);return result;
 }
 function sync(){source.value=read().map(p=>p.texto).join('\n');source.dispatchEvent(new Event('input',{bubbles:true}))}
 function set(text='',rich=[]){if(!editor){if(!init())return;}if(rich?.length){editor.innerHTML=rich.map(p=>'<p style="text-align:'+({justificado:'justify',esquerda:'left',centro:'center',direita:'right'}[p.alinhamento]||'')+'">'+(p.runs?.length?p.runs:[{texto:p.texto}]).map(r=>'<span style="font-weight:'+(r.negrito?'700':'400')+';font-style:'+(r.italico?'italic':'normal')+';text-decoration:'+(r.sublinhado?'underline':'none')+'">'+esc(r.texto)+'</span>').join('')+'</p>').join('');}else editor.innerHTML=String(text).split('\n').map(t=>'<p>'+esc(t||'')+'</p>').join('');source.value=text;}
 window.courseEditor={read,set};
 document.addEventListener('DOMContentLoaded',()=>{init();const mode=document.querySelector('[name="conteudo_formato"]');if(mode)mode.addEventListener('change',()=>{editor.style.textAlign=mode.value==='justificado'?'justify':'left';[...editor.querySelectorAll('p,div,li')].forEach(p=>p.style.textAlign=editor.style.textAlign);sync()})});
})();
