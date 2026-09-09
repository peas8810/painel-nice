from pathlib import Path
import base64, gzip, json, re, hashlib

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "docintel_part1.js": (16000, "33358892e7e352a35a3c291576d5e5db9c9923a329c27a65fae60f087cf5f675"),
    "docintel_part2.js": (16000, "71391936deefc66e970f4643007ed56e11ca71f5d392fe35ff0fbd4e6b22649e"),
    "docintel_part3a.js": (8000, "4608ba924c5ef127d43f409a6b0424e473bb64c3700c88e48e92bc69b7c7a732"),
    "docintel_part3b.js": (8000, "31834d1dd0eded297e773dd01e55127ee9eea1518fb4b1932928660c53b04cfe"),
    "docintel_part4.js": (15180, "764e82eb7a7462d4e368d1ed064e31dd978d287f5ee365db5d5da67f79f76a3b"),
}

parts = []
for name in EXPECTED:
    text = (ROOT / name).read_text(encoding="utf-8")
    m = re.search(r"push\('([^']*)'\);", text, flags=re.S)
    if not m:
        raise RuntimeError(f"Não foi possível extrair o Base64 de {name}")
    chunk = re.sub(r"[^A-Za-z0-9+/=]", "", m.group(1))
    h = hashlib.sha256(chunk.encode()).hexdigest()
    exp_len, exp_hash = EXPECTED[name]
    print(f"CHECK {name}: len={len(chunk)} sha256={h} expected_len={exp_len} expected_sha256={exp_hash} ok={len(chunk)==exp_len and h==exp_hash}")
    parts.append(chunk)

b64 = "".join(parts)
if len(b64) % 4:
    b64 += "=" * (4 - len(b64) % 4)

raw = base64.b64decode(b64, validate=False)
payload = gzip.decompress(raw)
data = json.loads(payload.decode("utf-8"))

if data.get("n") != 1320 or data.get("r") != 379:
    raise RuntimeError(f"Payload inesperado: n={data.get('n')} r={data.get('r')}")

(ROOT / "docintel_payload_v2.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
)

source = (ROOT / "docintel_v1.js").read_text(encoding="utf-8")
source = source.replace('const GZ=(window.__NICE_DOCINTEL_CHUNKS||[]).join("");\nif(!GZ)return;\n', "")
source = re.sub(r'async function gunzip\(b64\)\{.*?\}\nconst synonymGroups=', 'const synonymGroups=', source, count=1, flags=re.S)
source = source.replace(
    'gunzip(GZ).then(txt=>{\n const C=JSON.parse(txt),D=C.dict;',
    'fetch("docintel_payload_v2.json?ts="+Date.now(),{cache:"no-store"})'
    '.then(r=>{if(!r.ok)throw new Error("Falha HTTP "+r.status+" ao buscar a base documental");return r.json()})'
    '.then(C=>{\n const D=C.dict;'
)
if "docintel_payload_v2.json" not in source:
    raise RuntimeError("Falha ao transformar docintel_v1.js em loader JSON")
(ROOT / "docintel_json_v2.js").write_text(source, encoding="utf-8")

index_path = ROOT / "index.html"
index = index_path.read_text(encoding="utf-8")
index = re.sub(
    r'<script src="docintel_part1\.js(?:\?[^\"]*)?"></script>\s*'
    r'<script src="docintel_part2\.js(?:\?[^\"]*)?"></script>\s*'
    r'<script src="docintel_part3a\.js(?:\?[^\"]*)?"></script>\s*'
    r'<script src="docintel_part3b\.js(?:\?[^\"]*)?"></script>\s*'
    r'<script src="docintel_part4\.js(?:\?[^\"]*)?"></script>\s*'
    r'<script src="docintel_v1\.js(?:\?[^\"]*)?"></script>',
    '<script>document.write(\'<script src="docintel_json_v2.js?ts=\'+Date.now()+\'"><\\/script>\')</script>',
    index,
    count=1,
)
if "docintel_json_v2.js" not in index:
    raise RuntimeError("Não foi possível atualizar as referências da Inteligência Documental no index.html")
index_path.write_text(index, encoding="utf-8")
print(f"OK: payload documental reconstruído ({len(payload)} bytes) e index atualizado")
