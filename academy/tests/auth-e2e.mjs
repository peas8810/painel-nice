// Academy: E2E com duas contas de teste previamente confirmadas.
// npm i -D playwright && npx playwright install chromium
// Configure ACADEMY_E2E_EMAIL_A, ACADEMY_E2E_PASSWORD_A,
// ACADEMY_E2E_EMAIL_B, ACADEMY_E2E_PASSWORD_B como variáveis de ambiente.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.ACADEMY_E2E_URL||'https://www.protocolo.me/academy/portal/';
const accounts=[['ACADEMY_E2E_EMAIL_A','ACADEMY_E2E_PASSWORD_A'],['ACADEMY_E2E_EMAIL_B','ACADEMY_E2E_PASSWORD_B']].map(a=>a.map(k=>process.env[k]));
if(accounts.some(a=>a.some(x=>!x))||accounts[0][0]===accounts[1][0])throw Error('Defina duas contas distintas confirmadas nas variáveis de ambiente.');
const browser=await chromium.launch({headless:true});
const sessions=[];
async function http(page,path,method='GET',body) {
 return page.evaluate(async({path,method,body})=>{
  const cfg=window.ACADEMY_AUTH_CONFIG;
  const key=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token'));
  if(!key)throw new Error('Sessão ausente');
  const token=JSON.parse(localStorage.getItem(key)).access_token;
  const res=await fetch(cfg.url+'/rest/v1/'+path,{method,headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return {code:res.status,text:await res.text()};
 },{path,method,body});
}
try{
 for(const [email,password] of accounts){
  const context=await browser.newContext(),page=await context.newPage();
  sessions.push({context,page});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#academy-login button[type=submit]').click();
  await page.getByText('Acesso confirmado.',{exact:true}).waitFor({timeout:25000});
 }
 console.log('PASS: duas contas confirmadas conseguem login');
 const activity='Teste automático Academy '+Date.now();
 const inserted=await http(sessions[0].page,'academy_requests','POST',{activity,activity_type:'atividade_independente',start_date:'2026-10-01',end_date:'2026-10-01',hours_declared:1,description:'Atividade fictícia para teste automatizado de isolamento por usuário'});
 assert.equal(inserted.code,201,inserted.text);
 console.log('PASS: conta A registra solicitação');
 const path='academy_requests?select=id,activity&activity=eq.'+encodeURIComponent(activity);
 const own=await http(sessions[0].page,path);
 assert.equal(own.code,200,own.text);
 const records=JSON.parse(own.text);
 assert.equal(records.length,1);
 const other=await http(sessions[1].page,path);
 assert.equal(other.code,200,other.text);
 assert.equal(JSON.parse(other.text).length,0,'FALHA: conta B leu pedido de A');
 console.log('PASS: conta B não lê os pedidos de A');
 const attack=await http(sessions[0].page,'academy_requests?id=eq.'+records[0].id,'PATCH',{status:'APROVADO'});
 assert.ok([401,403].includes(attack.code),'FALHA: alteração do status: '+attack.code);
 console.log('PASS: aluno não altera status administrativo');
 console.log('TESTE CONCLUÍDO. Exclua o pedido fictício por rotina administrativa segura.');
}finally{for(const s of sessions)await s.context.close();await browser.close();}
