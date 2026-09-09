from pathlib import Path
import base64, gzip, json, re, hashlib

ROOT=Path(__file__).resolve().parents[1]
BLOCK10='tZRAqlgdllz/YqvHZi4N28I+9q6OIrxoN2YhkxXcqiPfVbFqgm/xFdoURyAmaLowiBM3n1JNY3FyRt1C2RsCVZ1fDkdNMJNzetIqXm9qzG/hz5pboH5arQXnDjq5Wk4Aa7Nws+8aPXZTaLAVgYRUOf0E5DV9mXc5AYe0Km9mp2K/09TSWA5b7juG98i6DCGEltxU0B8uEzZg1oz2EVItgE8KD/rgdZdt8O8zun5+pml4RUo2DrmWqI9nLcrXTavLQxkgesgfDzoAlNIt1ZKXOl0JQFqmv8dFBYTswbp5VdhKKcl9m0vM71pLdMZJ5lxSWnouu8K7vquQRvOo5cShWHFLhI18w4AYVcHZsrZckUbLLtDTmxz7PufLKeMT8SPtYPCd72wiMCwk8qL5KREVcknlAW5lWbGUCzIm0UpoT7Ru0hISgf+g7LkWVXer2mukXy5avpFVo7BLtT+tFdu5sA4zWAo1qHAp/5m45Yu+42dc8UX7jck97Hx00KHMfkia2uSgKFKQXeglh1fsedPS8UVGHy9+aBl4rK2qYMga/myfb2SH6Sq3yVELF+UaMcCKznW6vokQqDmTyy+7KlWjAbjoWjVEo0UCLK1tzZaenN7UwVZLad2HWtS6h1Xl2WullGWtbSkyyboqubGa+VAes1XaOFbkXP4GMNtV/C/x/gSW3pK186WVXeo006n5nAsLwT6zDgS1osL5y7HSvkpYp4Ilr7PL2ytmAwsKtVnGBi03WoY/l1cLT0sWFFuLq7fcmnfe9POyQc+SG1PS5IIz4luXJUnleWyQzryR5ufy4FxSG4PhaV7JMjJ1sp2mM8eKeF5ksvyhRZicJY7OHWNb5y2Kw6JQw5y1pWWilp28xajwndvJJglbkutkXYEU5O42cduSm7uQgvlOLSlYGQxplNUefZtlpeZ4B7moXehU+LE/1xriXLYIHlHfqiwZuazZI7Ss+lguuOWkcuNnYr9U0uX0fM51voszHTubAO2/'
BLOCK13='wQtLuL/sCig5hTjldL5R08jsBIhEFXFeS18PR7Owl8ymlr8YrmfMXk5vls5fAPUt0psc9LUU1QG8KiRgxhkisVGvjqL8Yn5lU6tTUVafvfch57PmxKZs2yhQsovMZVPt5RwnZ8bV3nZVt+6KraxBTjUQ8wO89AeMdkQ49wc4UdvZRrWqGmVzSUkNdwzuooQfYhDi5ev8XiU32RWMCv+jwH/4xz+zp/gP7IjPhzP+FRHLjciLv/wLB3vDGY7PFlNc5uZfiaFQjn78jfjnmNBAYiNxpxsEf8Szf5t/iqMidzfZ0X5DC+2KQ1Yz5vg3WX1yUWlf9sCmSumAv1cU3/IeH8BrqByBLJ2a04vlgN5f/lWM+n/GB7bl30uA0fm7H/7H7XfP1Anf+867rQtbt/Xj9nu37X+gv47/dNM2BbcNYdy6jku+99vuz2OKlOxdorSbRn6wj5J2P/yw7ejf93EbtokyqHvaDlvHVUud8ode2A1S8djz++i1VjEq8wkV80t87EvFrqnaddu0Hahub3VPVLfv+m0fu22fkjTaD9K8aLVUv+eW9n77fbdF67ZOPt9347an/13oe/ozcM3fD55b1o8DZcaOGzbya6Mk+1z7on2UlW51ozUxjtPWDfT9U0fvS2GSDghcefD8ej9NXOXEN0JEeq3xgSqPVPmAxvPHem7vQAMXIo2o70dp+Nb9ufRNz73ccVmYnLQ6SbWOfrj9N1Tc/6kVc3cEVCwTIW3zoE0pUIf47eBD6Y84cGeHDtODGxMCvyuMa70dtdmU4soHnabJ0zhTzb6LMo50la7m233uaIyo61eHUZvNDeBnXaTXOE8Vx8j1TpjDg1TLD/RB5i23YEDSP2pwnxssn0ozPNEKoIlHK9FF6WU0UqZ4st6lx4d2bVTNHane0XMXyABSW53co7b0E5UNgcYwSI13P+Y2DaVNuiCGgadqHLZjmrZ+GqQfU/5IJ03UJcRrbfhhtWIenR6TipqZZIDoY3tH'
EXPECTED='33358892e7e352a35a3c291576d5e5db9c9923a329c27a65fae60f087cf5f675'

def get_chunk(name):
    t=(ROOT/name).read_text(encoding='utf-8')
    m=re.search(r"push\('([^']*)'\);",t,re.S)
    if not m: raise RuntimeError('chunk not found: '+name)
    return re.sub(r'[^A-Za-z0-9+/=]','',m.group(1))

p1=get_chunk('docintel_part1.js')
if len(p1)!=15999: raise RuntimeError(f'Unexpected part1 length {len(p1)}')
# Diagnostic proved: blocks 0-9 are intact; one character is missing inside block 10;
# blocks 11-12 line up at -1; block 13 has an independent same-length corruption;
# blocks 14-15 again line up at -1.
p1=p1[:10000]+BLOCK10+p1[10999:]
p1=p1[:13000]+BLOCK13+p1[14000:]
if len(p1)!=16000 or hashlib.sha256(p1.encode()).hexdigest()!=EXPECTED:
    raise RuntimeError('Exact repair did not match canonical hash')

parts=[p1,get_chunk('docintel_part2.js'),get_chunk('docintel_part3a.js'),get_chunk('docintel_part3b.js'),get_chunk('docintel_part4.js')]
b64=''.join(parts)
raw=base64.b64decode(b64,validate=True)
payload=gzip.decompress(raw)
data=json.loads(payload.decode('utf-8'))
if data.get('n')!=1320 or data.get('r')!=379: raise RuntimeError('Unexpected documentary payload')
(ROOT/'docintel_payload_v2.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

src=(ROOT/'docintel_v1.js').read_text(encoding='utf-8')
src=src.replace('const GZ=(window.__NICE_DOCINTEL_CHUNKS||[]).join("");\nif(!GZ)return;\n','')
src=re.sub(r'async function gunzip\(b64\)\{.*?\}\nconst synonymGroups=','const synonymGroups=',src,count=1,flags=re.S)
src=src.replace('gunzip(GZ).then(txt=>{\n const C=JSON.parse(txt),D=C.dict;','fetch("docintel_payload_v2.json?ts="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Falha HTTP "+r.status+" ao buscar a base documental");return r.json()}).then(C=>{\n const D=C.dict;')
if 'docintel_payload_v2.json' not in src: raise RuntimeError('Loader transformation failed')
(ROOT/'docintel_json_v2.js').write_text(src,encoding='utf-8')

idx=(ROOT/'index.html').read_text(encoding='utf-8')
idx=re.sub(r'<script src="docintel_part1\.js(?:\?[^\"]*)?"></script>\s*<script src="docintel_part2\.js(?:\?[^\"]*)?"></script>\s*<script src="docintel_part3a\.js(?:\?[^\"]*)?"></script>\s*<script src="docintel_part3b\.js(?:\?[^\"]*)?"></script>\s*<script src="docintel_part4\.js(?:\?[^\"]*)?"></script>\s*<script src="docintel_v1\.js(?:\?[^\"]*)?"></script>','<script>document.write(\'<script src="docintel_json_v2.js?ts=\'+Date.now()+\'"><\\/script>\')</script>',idx,count=1)
if 'docintel_json_v2.js' not in idx: raise RuntimeError('index transformation failed')
(ROOT/'index.html').write_text(idx,encoding='utf-8')
print('OK documentary payload',data['n'],data['r'],len(payload))
