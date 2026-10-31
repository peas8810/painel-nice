/* Google Picker: select a student's PDF/JPG/PNG and import it through the shared Academy evidence workflow. */
(()=>{
 const button=document.getElementById('drive-picker-button'),status=document.getElementById('evidence-status');
 if(!button)return;
 const config=window.ACADEMY_DRIVE_CONFIG||{};
 const say=s=>{status.textContent=s};
 const loadScript=src=>new Promise((resolve,reject)=>{
   const el=document.createElement('script');el.src=src;el.async=true;el.onload=resolve;el.onerror=()=>reject(Error('Falha ao carregar recurso do Google'));document.head.appendChild(el)
 });
 let initialized=false,tokenClient=null,token=null;
 async function init(){
  if(initialized)return;
  await Promise.all([loadScript('https://apis.google.com/js/api.js'),loadScript('https://accounts.google.com/gsi/client')]);
  await new Promise((resolve,reject)=>window.gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Google Picker indisponível'))}));
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:config.clientId,scope:'https://www.googleapis.com/auth/drive.file',
    callback:response=>{if(response.error){say('A autorização do Google Drive não foi concluída.');return}token=response.access_token;openPicker()}
  });
  initialized=true
 }
 async function choose(doc){
  const id=doc[google.picker.Document.ID],name=doc[google.picker.Document.NAME]||'arquivo';
  const mime=doc[google.picker.Document.MIME_TYPE]||'';
  if(!['application/pdf','image/jpeg','image/png'].includes(mime)){say('Selecione um PDF, JPG ou PNG.');return}
  const requestId=document.getElementById('evidence-request').value;
  if(!requestId){say('Selecione primeiro um protocolo.');return}
  button.disabled=true;
  try{
   say('Importando arquivo do Google Drive…');
   const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,size',{headers:{Authorization:'Bearer '+token}});
   if(!metadata.ok)throw Error('Não foi possível consultar o arquivo do Drive ('+metadata.status+').');
   const info=await metadata.json();
   if(Number(info.size)>10485760)throw Error('O arquivo excede 10 MB.');
   if(!['application/pdf','image/jpeg','image/png'].includes(info.mimeType))throw Error('Formato não permitido.');
   const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw Error('O Google Drive não liberou o arquivo ('+response.status+').');
   const blob=await response.blob();
   if(blob.size>10485760||!blob.size)throw Error('Arquivo vazio ou maior que 10 MB.');
   const file=new File([blob],name,{type:info.mimeType});window.academySelectedEvidence=file;
   if(typeof window.academyUploadEvidence!=='function')throw Error('Envio do Academy indisponível.');
   await window.academyUploadEvidence(file,requestId);
  }catch(e){say('Não foi possível importar do Drive: '+(e.message||e))}
  finally{button.disabled=false}
 }
 function openPicker(){
  const view=new google.picker.DocsView(google.picker.ViewId.DOCS);
  view.setMimeTypes('application/pdf,image/jpeg,image/png');
  const picker=new google.picker.PickerBuilder().addView(view)
   .setOAuthToken(token).setDeveloperKey(config.apiKey).setAppId(config.appId)
   .setOrigin(window.location.origin)
   .setTitle('Selecionar comprovante no Google Drive')
   .setCallback(data=>{
     if(data[google.picker.Response.ACTION]===google.picker.Action.PICKED){
       const doc=data[google.picker.Response.DOCUMENTS]?.[0];if(doc)choose(doc)
     }
   }).build();
  picker.setVisible(true)
 }
 button.addEventListener('click',async()=>{
  if(!document.getElementById('evidence-request').value){say('Cadastre ou selecione um protocolo antes de escolher o arquivo.');return}
  if(!config.clientId||!config.apiKey||!config.appId){say('A integração com Google Drive aguarda configuração no Google Cloud. Utilize o envio do dispositivo por enquanto.');return}
  button.disabled=true;
  try{say('Abrindo Google Drive…');await init();tokenClient.requestAccessToken({prompt:token?'':'consent'})}
  catch(e){say('Não foi possível abrir o Drive: '+(e.message||e))}
  finally{button.disabled=false}
 });
})();
