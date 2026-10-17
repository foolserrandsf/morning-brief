import json,sys,math
D='/tmp/claude-0/-home-claude/4c36af1d-0797-5c08-87b7-81ef7cf99747/scratchpad/geo/ne/10m/'
BOXES=[(-10.5,35,31,56.5),(-125,31,-113,49.5),(115,-44,154,-26),(165,-47.5,179,-34),(-74,-42,-64,-28),(17,-35,21,-32)]
def inbox(b,boxes=BOXES):
    x0,y0,x1,y1=b
    return any(not(x1<a or x0>c or y1<bb or y0>d) for a,bb,c,d in boxes)
def bbox(pts):
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]; return (min(xs),min(ys),max(xs),max(ys))
def dp(pts,tol):
    if len(pts)<3: return pts
    keep=[False]*len(pts); keep[0]=keep[-1]=True; st=[(0,len(pts)-1)]
    while st:
        i,j=st.pop(); ax,ay=pts[i]; bx,by=pts[j]; dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy)
        mi,md=-1,0
        for k in range(i+1,j):
            px,py=pts[k]
            d=abs(dy*(px-ax)-dx*(py-ay))/L if L else math.hypot(px-ax,py-ay)
            if d>md: md,mi=d,k
        if md>tol and mi>0: keep[mi]=True; st+=[(i,mi),(mi,j)]
    return [p for p,k in zip(pts,keep) if k]
def enc(pts):
    out=[];px=py=0
    for x,y in pts:
        X,Y=round(x*100),round(y*100)
        if out and X==px and Y==py: continue
        out+= [X-px,Y-py]; px,py=X,Y
    return out
def rings(g):
    if not g: return []
    if g['type']=='Polygon': return [g['coordinates'][0]]
    if g['type']=='MultiPolygon': return [p[0] for p in g['coordinates']]
    if g['type']=='LineString': return [g['coordinates']]
    if g['type']=='MultiLineString': return g['coordinates']
    return []
C=json.load(open(D+'cultural/ne_10m_admin_0_countries.json'))
world=[];det=[];worldc=[];detc=[]
for fi,f in enumerate([f for f in C['features'] if rings(f['geometry'])]):
    nm=f['properties'].get('NAME_EN') or f['properties']['NAME']
    for r in rings(f['geometry']):
        b=bbox(r)
        if (b[2]-b[0])*(b[3]-b[1])<0.02 and not inbox(b): continue
        if inbox(b):
            s=dp(r,0.012)
            if len(s)>=4: det.append(enc(s)); detc.append(fi)
        else:
            s=dp(r,0.12)
            if len(s)>=4: world.append(enc(s)); worldc.append(fi)
names=[]
def area(r):
    return abs(sum(r[i][0]*r[i-1][1]-r[i-1][0]*r[i][1] for i in range(len(r))))/2
def cen(r):
    A=0;cx=cy=0
    for i in range(len(r)):
        x0,y0=r[i-1];x1,y1=r[i];c=x0*y1-x1*y0;A+=c;cx+=(x0+x1)*c;cy+=(y0+y1)*c
    return (cx/(3*A),cy/(3*A)) if A else r[0]
for f in C['features']:
    p=f['properties'];rs=rings(f['geometry'])
    if not rs: continue
    big=max(rs,key=area); x,y=cen(big)
    names.append([p['NAME'],round(x,2),round(y,2),p.get('MIN_LABEL',5)])
R=json.load(open(D+'physical/ne_10m_rivers_lake_centerlines.json'))
riv=[]
for f in R['features']:
    p=f['properties']
    if p.get('scalerank',10)>8 or p.get('featurecla','').startswith('Lake'): continue
    for l in rings(f['geometry']):
        if len(l)<2 or not inbox(bbox(l)): continue
        s=dp(l,0.01)
        FIX={'Sane':'Saône','Duero':'Douro (Duero)'}
        nm=p.get('name_en') or p.get('name') or ''
        riv.append([FIX.get(nm,nm),p.get('scalerank'),enc(s)])
Lk=json.load(open(D+'physical/ne_10m_lakes.json'))
lakes=[]
for f in Lk['features']:
    if f['properties'].get('scalerank',10)>6: continue
    for r in rings(f['geometry']):
        b=bbox(r)
        if not inbox(b) or (b[2]-b[0])*(b[3]-b[1])<0.003: continue
        s=dp(r,0.01)
        if len(s)>=4: lakes.append(enc(s))
P=json.load(open(D+'cultural/ne_10m_populated_places_simple.json'))
cities=[]
for f in P['features']:
    p=f['properties']; x,y=f['geometry']['coordinates']
    lim=8 if inbox((x,y,x,y)) else 2
    if p['scalerank']<=lim: cities.append([p['name'],round(x,2),round(y,2),p['scalerank']])
out={'v':2,'world':world,'det':det,'worldc':worldc,'detc':detc,'names':names,'rivers':riv,'lakes':lakes,'cities':cities}
s=json.dumps(out,separators=(',',':'),ensure_ascii=False)
open(sys.argv[1],'w').write(s)
print(len(s), {k:len(json.dumps(v,separators=(',',':'))) for k,v in out.items() if k!='v'})
