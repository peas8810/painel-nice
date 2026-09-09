from pathlib import Path
import base64, gzip, json, re

ROOT = Path(__file__).resolve().parents[1]

# Reconstrói o payload a partir dos fragmentos já versionados no repositório.
# O parser extrai SOMENTE o conteúdo Base64 dos push(...), removendo qualquer
# caractere estranho antes da decodificação. Isso elimina problemas de atob/cache.
parts = []
for name in [
    "docintel_part1.js",
    "docintel_part2.js",
    "docintel_part3a.js",
    "docintel_part3b.js",
    "docintel_part4.js",
]:
    text = (ROOT / name).read_text(encoding="utf-8")
    m = re.search(r"push\('([^']*)'\);", text, flags=re.S)
    if not m:
        raise RuntimeError(f"Não foi possível extrair o Base64 de {name}")
    chunk = re.sub(r"[^A-Za-z0-9+/=]", "", m.group(1))
    parts.append(chunk)

b64 = "".join(parts)
if len(b64) % 4:
    b64 += "=" * (4 - len(b64) % 4)

raw = base64.b64decode(b64, validate=False)
payload = gzip.decompress(raw)
data = json.loads(payload.decode("utf-8"))

if data.get("n") != 1320 or data.get("r") != 379:
    raise RuntimeError(
        f"Payload inesperado: n={data.get('n')} r={data.get('r')}"
    )

# JSON puro: o navegador não precisa mais de atob nem DecompressionStream.
(ROOT / "docintel_payload_v2.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)

# Gera automaticamente um loader JSON reutilizando a interface já existente.
source = (ROOT / "docintel_v1.js").read_text(encoding="utf-8")
source = source.replace(
    'const GZ=(window.__NICE_DOCINTEL_CHUNKS||[]).join("");\nif(!GZ)return;\n',
    "",
)
source = re.sub(
    r'async function gunzip\(b64\)\{.*?\}\nconst synonymGroups=',
    'const synonymGroups=',
    source,
    count=1,
    flags=re.S,
)
source = source.replace(
    'gunzip(GZ).then(txt=>{\n const C=JSON.parse(txt),D=C.dict;',
    'fetch("docintel_payload_v2.json?ts="+Date.now(),{cache:"no-store"})'
    '.then(r=>{if(!r.ok)throw new Error("Falha HTTP "+r.status+" ao buscar a base documental");return r.json()})'
    '.then(C=>{\n const D=C.dict;',
)

if "docintel_payload_v2.json" not in source:
    raise RuntimeError("Falha ao transformar docintel_v1.js em loader JSON")

(ROOT / "docintel_json_v2.js").write_text(source, encoding="utf-8")

# Atualiza o HTML para não executar mais os fragmentos Base64 no navegador.
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
