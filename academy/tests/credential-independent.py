"""Verify a synthetic Academy ES256 credential using Python cryptography, independently of WebCrypto."""
import base64,json,subprocess
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec,utils
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature
root=Path(__file__).resolve().parents[2]
js="""import {signCredential} from './academy/supabase/functions/academy-modules/core.mjs';
const p=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
console.log(JSON.stringify({jwk:await crypto.subtle.exportKey('jwk',p.publicKey),jwt:await signCredential({id:'urn:uuid:test-only',issuer:'https://www.protocolo.me/academy/',type:['VerifiableCredential']},await crypto.subtle.exportKey('jwk',p.privateKey),'synthetic-test-key')}));"""
x=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root))
def decode(x):return base64.urlsafe_b64decode(x+'='*((-len(x))%4))
header,payload,sig=x['jwt'].split('.')
assert json.loads(decode(header))['alg']=='ES256'
key=ec.EllipticCurvePublicNumbers(int.from_bytes(decode(x['jwk']['x']),'big'),int.from_bytes(decode(x['jwk']['y']),'big'),ec.SECP256R1()).public_key()
raw=decode(sig);assert len(raw)==64
signature=utils.encode_dss_signature(int.from_bytes(raw[:32],'big'),int.from_bytes(raw[32:],'big'))
key.verify(signature,(header+'.'+payload).encode(),ec.ECDSA(hashes.SHA256()))
try:key.verify(signature,(header+'.'+payload+'changed').encode(),ec.ECDSA(hashes.SHA256()))
except InvalidSignature:pass
else:raise AssertionError('Tampered credential accepted')
print('Independent Python verifier: ES256 signature accepted; tampering rejected. No wallet interoperability claim.')
