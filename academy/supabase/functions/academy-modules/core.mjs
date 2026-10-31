export const encoder=new TextEncoder();
export const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export const tokenValid=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export const hash=async value=>hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));
export const secret=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const active=row=>Boolean(row&&!row.revoked_at&&Date.parse(row.expires_at)>Date.now());
export function regulationAnswer(rows,category,hours,question='') {
 const eligible=rows.filter(r=>r.category.toLocaleLowerCase()===category.toLocaleLowerCase());
 if(!eligible.length)return {answer:'Não encontrei regra publicada e vigente para esta categoria. Consulte a instituição.',citations:[],requires_human:true};
 const tokens=question.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu)||[];
 const ranked=eligible.map(r=>({r,score:tokens.filter(w=>(r.title+' '+r.clause_text).toLocaleLowerCase().includes(w)).length})).sort((a,b)=>b.score-a.score);
 const caps=eligible.map(r=>Number(r.max_hours)).filter(x=>Number.isFinite(x)&&x>0);
 const cap=caps.length?Math.min(...caps):null;
 const candidate=Number.isFinite(hours)&&hours>0&&cap!==null?Math.min(hours,cap):null;
 return {answer:(candidate!==null?`Para ${hours} horas declaradas, o limite numérico cadastrado nesta categoria permite solicitar até ${candidate} horas. `:'Consulte as condições nas regras abaixo. ')+ 'A elegibilidade depende também das condições do regulamento e da análise humana. Esta orientação não aprova horas.',citations:ranked.slice(0,5).map(({r})=>({id:r.id,title:r.title,version:r.version,text:r.clause_text,url:r.source_url,valid_from:r.valid_from,valid_until:r.valid_until})),requires_human:true};
}
export const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function signCredential(payload,jwk,kid){
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const body=b64(encoder.encode(JSON.stringify({alg:'ES256',typ:'vc+jwt',cty:'vc',kid})))+'.'+b64(encoder.encode(JSON.stringify(payload)));
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,encoder.encode(body));
 return body+'.'+b64(signature);
}
export async function verifyCredential(jwt,jwk,kid,issuer){
 if(typeof jwt!=='string'||jwt.length>40000)return false;
 try{const [a,b,c,...rest]=jwt.split('.');if(rest.length||!c)return false;const header=JSON.parse(new TextDecoder().decode(unb64(a))),payload=JSON.parse(new TextDecoder().decode(unb64(b)));
 if(header.alg!=='ES256'||header.typ!=='vc+jwt'||header.kid!==kid||payload.issuer!==issuer||!payload.type?.includes('VerifiableCredential')||payload['@context']?.[0]!=='https://www.w3.org/ns/credentials/v2'||!Number.isFinite(Date.parse(payload.validFrom))||Date.parse(payload.validFrom)>Date.now())return false;
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(c),encoder.encode(a+'.'+b));
 }catch{return false;}
}
