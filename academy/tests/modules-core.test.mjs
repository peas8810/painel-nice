import {test} from 'node:test';import assert from 'node:assert/strict';
import {regulationAnswer,active,hash,secret,tokenValid,signCredential,verifyCredential} from '../supabase/functions/academy-modules/core.mjs';
import {qualityMetrics,detectFormat} from '../assets/document-quality.mjs';
test('Copilot abstains with no matching rule and cites actual published clauses',()=>{
 assert.equal(regulationAnswer([],'Congresso',20).citations.length,0);
 const clause={id:'rule',category:'Congresso',max_hours:12,title:'Artigo 4',version:'2026',clause_text:'Exigir comprovante e participação integral',source_url:'https://example.org/rule'};
 const answer=regulationAnswer([clause],'Congresso',20,'comprovante');assert.match(answer.answer,/até 12 horas/);assert.equal(answer.citations[0].text,clause.clause_text);assert.equal(answer.citations[0].url,clause.source_url);assert.equal(answer.requires_human,true);
 assert.equal(regulationAnswer([clause],'Outra categoria',20).citations.length,0);
});
test('expired and revoked links are inactive; tokens are high entropy and hashes stable',async()=>{
 assert.equal(active({expires_at:new Date(Date.now()-1000).toISOString()}),false);assert.equal(active({expires_at:new Date(Date.now()+10000).toISOString(),revoked_at:'now'}),false);
 const a=secret(),b=secret();assert.ok(tokenValid(a));assert.notEqual(a,b);assert.equal((await hash(a)).length,64);assert.equal(await hash(a),await hash(a));
});
test('SecureDocs detects file headers and flags blank low contrast image',()=>{
 assert.equal(detectFormat(new TextEncoder().encode('%PDF-1.7')),'application/pdf');assert.equal(detectFormat(new TextEncoder().encode('<script>')),null);
 const rgba=new Uint8ClampedArray(20*20*4).fill(255),q=qualityMetrics(rgba,20,20);assert.ok(q.warnings.includes('Pouco contraste'));assert.ok(q.score<60);
});
test('credential signature verifies independently and rejects tampering, issuer and algorithm confusion',async()=>{
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),priv=await crypto.subtle.exportKey('jwk',keys.privateKey),pub=await crypto.subtle.exportKey('jwk',keys.publicKey);
 const payload={'@context':['https://www.w3.org/ns/credentials/v2'],id:'urn:uuid:test',type:['VerifiableCredential'],issuer:'https://issuer.example',validFrom:new Date(Date.now()-1000).toISOString(),credentialSubject:{name:'Teste'}};
 const token=await signCredential(payload,priv,'key-1');assert.equal(await verifyCredential(token,pub,'key-1',payload.issuer),true);
 const parts=token.split('.');const altered=Buffer.from(JSON.stringify({...payload,credentialSubject:{name:'Alterado'}})).toString('base64url');assert.equal(await verifyCredential([parts[0],altered,parts[2]].join('.'),pub,'key-1',payload.issuer),false);
 assert.equal(await verifyCredential(token,pub,'key-2',payload.issuer),false);assert.equal(await verifyCredential(token,pub,'key-1','https://attacker.example'),false);
 const head=Buffer.from(JSON.stringify({alg:'none',typ:'vc+jwt',kid:'key-1'})).toString('base64url');assert.equal(await verifyCredential([head,parts[1],parts[2]].join('.'),pub,'key-1',payload.issuer),false);
});
