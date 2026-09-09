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

# Hashes dos 16 blocos corretos de 1.000 caracteres do fragmento 1.
# Eles permitem recuperar deterministicamente uma eventual perda de 1 caractere
# sem armazenar novamente o payload inteiro no workflow.
P1_BLOCK_HASHES = [
    "1f907ee7454775596a210bb5a69f23264a94ceaab58176e238661d022e03d810",
    "3ad88e3ab9f9318cef7ba18b7c22a4088e4c7db27d36c07db5f367cd1eb03ef8",
    "59d7cad58c3faf8c656bb04d728f187ef5e37ce99c723097d6943d05919b59b9",
    "8be55f7b774f1f24f0b34d8769a88855937118beb67736a09961e3da252a41ea",
    "ce7ed80521ea0d8cde7e7b13eeac2fa2765c9bd8b3fa52302e105a2d149d48e2",
    "d9a97d4f22729aa0fc31f6a66ad2cdab04c717670bb5f1857ffae453841adbdd",
    "2bcda67d8d6bbfec2cd8b52bbd1854da0852e3cb3cd3e95482b99112babc66ba",
    "141c0bf4f9b78942ea9214a452f61786a134b5b079804730bdf6e7150eabb9ce",
    "f757be15a17f52def093b704fe8353c58c65588fbbae7181fd7c9fa629fea5b4",
    "452fa19ce4ce8390294513656814c183aed9b49736950ed1cc8017cf0870f005",
    "79050393862118a66291e37908d4b83179ca7dade8095def919b8bf030aecdc9",
    "301e6fc36f1a78d6aa20123dba0229aa995f3bd2946708771caeb8554c44d5e1",
    "919f3d5a0758466d8ab9602b8149e79996971084705d23b4bf14fa3260d084fd",
    "a63625b69a22eca78e7ee8c083a7df7e16abcd7d3914e2d7f2e37853d20c5b46",
    "85c35fe3c433f5a32fd98809953e6523cafaf31983521a95af3c5740e551dd4d",
    "6aed146d68dc77c3701e1255b3259478f916c615d65e05471814baedd1396e8e",
]
BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def sha(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def repair_part1(chunk: str) -> str:
    exp_len, exp_hash = EXPECTED["docintel_part1.js"]
    if len(chunk) == exp_len and sha(chunk) == exp_hash:
        return chunk
    if len(chunk) != exp_len - 1:
        raise RuntimeError(f"Fragmento 1 com comprimento inesperado: {len(chunk)}")

    # O primeiro bloco que não bate contém o caractere perdido.
    bad_block = None
    for i, expected_hash in enumerate(P1_BLOCK_HASHES):
        block = chunk[i * 1000:(i + 1) * 1000]
        if sha(block) != expected_hash:
            bad_block = i
            break
    if bad_block is None:
        raise RuntimeError("Não foi possível localizar a corrupção no fragmento 1")

    start = bad_block * 1000
    damaged = chunk[start:start + 999]
    expected_block_hash = P1_BLOCK_HASHES[bad_block]
    for pos in range(1000):
        for ch in BASE64_ALPHABET:
            candidate_block = damaged[:pos] + ch + damaged[pos:]
            if sha(candidate_block) == expected_block_hash:
                repaired = chunk[:start + pos] + ch + chunk[start + pos:]
                if len(repaired) == exp_len and sha(repaired) == exp_hash:
                    print(f"RECOVERED docintel_part1.js: inserted '{ch}' at position {start + pos}")
                    wrapper = "window.__NICE_DOCINTEL_CHUNKS=(window.__NICE_DOCINTEL_CHUNKS||[]);window.__NICE_DOCINTEL_CHUNKS.push('" + repaired + "');"
                    (ROOT / "docintel_part1.js").write_text(wrapper, encoding="utf-8")
                    return repaired
    raise RuntimeError("Falha ao recuperar o caractere perdido do fragmento 1")


parts = []
for name in EXPECTED:
    text = (ROOT / name).read_text(encoding="utf-8")
    m = re.search(r"push\('([^']*)'\);", text, flags=re.S)
    if not m:
        raise RuntimeError(f"Não foi possível extrair o Base64 de {name}")
    chunk = re.sub(r"[^A-Za-z0-9+/=]", "", m.group(1))
    if name == "docintel_part1.js":
        chunk = repair_part1(chunk)
    exp_len, exp_hash = EXPECTED[name]
    h = sha(chunk)
    print(f"CHECK {name}: len={len(chunk)} sha256={h} ok={len(chunk)==exp_len and h==exp_hash}")
    if len(chunk) != exp_len or h != exp_hash:
        raise RuntimeError(f"Integridade inválida em {name}")
    parts.append(chunk)

b64 = "".join(parts)
raw = base64.b64decode(b64, validate=True)
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
print(f"OK: payload documental reconstruído ({len(payload)} bytes), fragmento reparado e index atualizado")
