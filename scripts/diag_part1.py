from pathlib import Path
import re, hashlib

ROOT=Path(__file__).resolve().parents[1]
H=[
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
"6aed146d68dc77c3701e1255b3259478f916c615d65e05471814baedd1396e8e"]
s=(ROOT/'docintel_part1.js').read_text()
c=re.search(r"push\('([^']*)'\);",s,re.S).group(1)
c=re.sub(r'[^A-Za-z0-9+/=]','',c)
sha=lambda x:hashlib.sha256(x.encode()).hexdigest()
print('LEN',len(c),'FULL',sha(c))
for i,h in enumerate(H):
    direct=c[i*1000:(i+1)*1000]
    shifted=c[max(0,i*1000-1):max(0,(i+1)*1000-1)] if i else ''
    print(i,'direct',len(direct),sha(direct)==h,'shift-1',len(shifted),sha(shifted)==h if i else None)
