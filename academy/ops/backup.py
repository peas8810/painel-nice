"""Encrypted database + private Storage backup. No credentials are printed.
Requires: Python 3.11+, pg_dump, age. PG* environment connects pg_dump.
ACADEMY_BACKUP_URL, ACADEMY_BACKUP_SERVICE_KEY, ACADEMY_BACKUP_RECIPIENT
must be provided by the operator in a protected environment.
"""
import argparse, hashlib, json, os, pathlib, subprocess, tarfile, tempfile
import urllib.request, urllib.parse
BUCKETS=('academy-evidencias','academy-certificados')
def api(base,key,path,body=None):
 req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=90) as r:return r.read()
def objects(base,key,bucket,prefix=''):
 offset=0
 while True:
  batch=json.loads(api(base,key,'/storage/v1/object/list/'+bucket,{'prefix':prefix,'limit':100,'offset':offset,'sortBy':{'column':'name','order':'asc'}}))
  for row in batch:
   name=prefix+row['name']
   if row.get('id'):yield name
   else:yield from objects(base,key,bucket,name+'/')
  if len(batch)<100:break
  offset+=100

def verify(root):
 manifest=json.loads((root/'manifest.json').read_text())
 for row in manifest['files']:
  name=row['local']
  if pathlib.PurePosixPath(name).is_absolute() or '..' in pathlib.PurePosixPath(name).parts:raise ValueError('Unsafe manifest path')
  path=root/name
  if not path.is_file() or path.is_symlink():raise ValueError('Missing backup member')
  if hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Backup integrity failed')
 return manifest

def export(output):
 base=os.environ['ACADEMY_BACKUP_URL'].rstrip('/');key=os.environ['ACADEMY_BACKUP_SERVICE_KEY'];recipient=os.environ['ACADEMY_BACKUP_RECIPIENT']
 if not base.startswith('https://'):raise ValueError('HTTPS required')
 if output.exists():raise ValueError('Output exists; use a new backup path')
 os.umask(0o077)
 with tempfile.TemporaryDirectory(prefix='academy-backup-') as tmp:
  root=pathlib.Path(tmp);payload=root/'payload';payload.mkdir();files=[]
  # Full pg_dump is an export; restoration into Supabase requires its supported
  # migration process because managed schemas, roles and Vault keys differ.
  subprocess.run(['pg_dump','--format=custom','--no-owner','--no-privileges','--file',str(payload/'database.dump')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  dump=payload/'database.dump';files.append({'local':'database.dump','sha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'kind':'database'})
  for bucket in BUCKETS:
   for name in objects(base,key,bucket):
    local='object-'+hashlib.sha256((bucket+'/'+name).encode()).hexdigest();data=api(base,key,'/storage/v1/object/authenticated/'+bucket+'/'+urllib.parse.quote(name,safe='/'))
    (payload/local).write_bytes(data);files.append({'kind':'storage','bucket':bucket,'object':name,'local':local,'sha256':hashlib.sha256(data).hexdigest()})
  manifest={'version':1,'source':base,'consistency':'Pause writes before export; database and Storage are not an atomic snapshot.','files':files}
  (payload/'manifest.json').write_text(json.dumps(manifest));verify(payload)
  with tarfile.open(root/'backup.tar','w') as archive:
   for p in payload.iterdir():archive.add(p,arcname=p.name)
  try:subprocess.run(['age','-r',recipient,'-o',str(output),str(root/'backup.tar')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  except Exception:
   output.unlink(missing_ok=True);raise
 print('Encrypted archive created. Isolated restoration has NOT been executed.')

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=pathlib.Path,required=True);args=p.parse_args()
 try:export(args.output)
 except Exception:raise SystemExit('Backup failed. Check protected connection settings, installed tools and permissions; credentials were not logged.')
