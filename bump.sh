#!/bin/sh
# Stamp a new build so phones pick up app changes.
B=$(date +%Y%m%d%H%M%S)
sed -i "s/var APP_BUILD='[0-9]*'/var APP_BUILD='$B'/" index.html
sed -i "s/var C='mb-v[0-9]*'/var C='mb-v$B'/" sw.js
