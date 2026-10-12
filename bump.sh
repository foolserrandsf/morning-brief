#!/bin/sh
# Stamp a new build so phones pick up app changes.
B=$(date +%Y%m%d%H%M%S)
sed -i "s/var APP_BUILD='[0-9]*'/var APP_BUILD='$B'/" index.html
sed -i "s/var C='mb-v[0-9]*'/var C='mb-v$B'/" sw.js
# Tell open phones a new app build exists (they reload once when they see it).
python3 - "$B" <<'PY'
import json,sys
p='data/latest.json';j=json.load(open(p));j['app']=sys.argv[1];json.dump(j,open(p,'w'))
PY
