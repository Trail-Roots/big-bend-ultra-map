# Executed inside make.py (BBU_EXPORT=1) right before savefig: dumps final geometry/decisions to /workspace/bbu-web/content
import json as _J, os as _O
from PIL import Image as _PI
_OUT='/workspace/bbu-web/content';_O.makedirs(_OUT+'/courses',exist_ok=True);_O.makedirs(_OUT+'/hillshade',exist_ok=True);_O.makedirs(_OUT+'/profiles',exist_ok=True)
_TI=pyproj.Transformer.from_crs(3857,4326,always_xy=True)
def _ll(P): P=np.asarray(P,float).reshape(-1,2);x,y=_TI.transform(P[:,0],P[:,1]);return [[round(float(a),6),round(float(b),6)] for a,b in zip(x,y)]
def _ll1(p): return _ll([p])[0]
def _fc(fs): return {'type':'FeatureCollection','features':fs}
def _ls(P,**pr): return {'type':'Feature','properties':pr,'geometry':{'type':'LineString','coordinates':_ll(P)}}
def _pt(p,**pr): return {'type':'Feature','properties':pr,'geometry':{'type':'Point','coordinates':_ll1(p)}}
def _poly(g,**pr): return {'type':'Feature','properties':pr,'geometry':{'type':'Polygon','coordinates':[_ll(np.array(g.exterior.coords))]+[_ll(np.array(r.coords)) for r in g.interiors]}}
def _w(n,o): _J.dump(o,open(f'{_OUT}/{n}','w'),separators=(',',':'))
_CLS={'F':'foot','A':'foot_bike','4':'4x4','T':'unpaved','zn':'foot','za':'foot_bike','z4':'4x4','zt':'unpaved','fm':'paved'}
# courses
for k in ORDER: _w(f'courses/{k}.geojson',_fc([_ls(RT[k],course=k,color=C[k],distance_mi=S[k][-1][1])]))
# network: on-course access runs + off-course roads + paved + connector
_net=[_ls(p,cls=_CLS[c],on_course=True) for c,p in _RUNS]
_net+=[_ls(c,cls=_CLS.get(k_,k_),on_course=False,name=n_) for k_,c,n_ in OFFR if len(c)>=2 and k_!='fm']
_net+=[_ls(c,cls='paved',on_course=False,name='FM 170') for c in FM]
_net+=[_ls(c,cls='connector',on_course=False,name='Contrabando connector') for c in CONL]
_w('network.geojson',_fc(_net))
# park
_pkf=[]
for e in _pk['elements']:
    nm=e['tags'].get('name','')
    if 'Visitor Center' in nm: continue
    for m in e['members']:
        if m['type']=='way' and 'geometry' in m: _pkf.append(_ls(P3([(p['lon'],p['lat']) for p in m['geometry']]),kind='boundary',name=nm))
_pkf.append(_poly(BIG,kind='park',name='Big Bend Ranch State Park'))
_pkf+=[_poly(f,kind='private') for f in INH]
_w('park.geojson',_fc(_pkf))
# zones (access.json polygons as used by the pipeline)
_w('zones.geojson',_fc([{'type':'Feature','properties':{'zone':n},'geometry':{'type':'Polygon','coordinates':[c+[c[0]]]}} for n,c in _J.load(open('access.json'))]))
# stations
_st={'order':list(NAME),'stations':{k:dict(name=NAME[k],kml=KN[k],lonlat=_ll1(T.transform(*pt(KN[k],'Aid'))),hours=HRS.get(k),spectator=k in SPEC,elevation_ft=round(STEL.get(k,0))) for k in NAME}}
_w('stations.json',_st)
_w('cutoffs.json',{k:[dict(station=l,mile=mi,cutoff=cut) for l,mi,cut in S[k]] for k in ORDER})
_w('courses.json',{'order':ORDER,'colors':C,'courses':{k:dict(distance_mi=S[k][-1][1],start=S[k][0][2],color=C[k]) for k in ORDER}})
_w('colors.json',dict(cream=CREAM,ink=INK,mute=MUTE,ring=RING,road=ROAD,aid_red=AIDRED,park=PG,offcourse='#9b968e',offcourse_4x4='#8f8a82',minis_network='#b9b3aa',minis_next='#a9a299',boundary='#8e8e8e',bar=BAR))
# POIs
_w('pois.geojson',_fc([_pt(RIN,kind='rincon',name='Rincon',note='no aid · restroom',elevation_ft=round(STEL['RIN'])),_ls(np.array(TURN),kind='turnaround',name='10K turnaround',course='10K')]))
# zoom boxes
_w('zoomboxes.geojson',_fc([{'type':'Feature','properties':{'course':k,'color':C[k]},'geometry':{'type':'Polygon','coordinates':[_ll([[a,c_],[b,c_],[b,d],[a,d],[a,c_]])]}} for k,((a,c_),(b,d)) in TB.items()]))
# arrows
_axk={id(ax):'main'};_axk.update({id(m):k for (m,_),k in zip(MINIS,ORDER)})
_arf=[]
for bd,p,lw_,z_ in FINAL:
    a_=_axof(bd);P=np.array(p);tip=P[1];P=tip+(P-tip)*1.45
    _arf.append(_ls(P,map=_axk[id(a_)],lw_pt=float(lw_*1.45),outline_pt=float(lw_*1.45+8.5)))
_w('arrows.geojson',_fc(_arf))
# labels: curved (textPath) + every other text artist on main map with its final placement
_r=fig.canvas.get_renderer();_lab=[]
for c in CURV_OUT:
    P=np.array(c['pts']);
    if c['rev']: pass
    _lab.append(_ls(P,kind='curved',text=c['text'],fs=c['fs'],color=c['color']))
_stp={k:np.array(T.transform(*pt(KN[k],'Aid'))) for k in NAME}
for t in ax.texts:
    s_=t.get_text()
    if not s_ or not t.get_visible() or str(t.get_label()).startswith('CL'): continue
    bb=t.get_window_extent(_r);cx_,cy_=ax.transData.inverted().transform(((bb.x0+bb.x1)/2,(bb.y0+bb.y1)/2))
    if s_ in ('0','5m','N'): continue
    kind='label'
    if s_ in NAME and t.get_color() in (CREAM,'white','#ffffff'): kind='station_number'
    elif t.get_gid()=='loc' and s_ in ORDER: kind='zoombox_label'
    elif s_.startswith('10K'): kind='poi_label'
    elif any(s_==NAME[k] or s_.startswith(NAME[k]) for k in NAME) or (t.get_gid()=='loc' and any(ch.isdigit() for ch in s_) and ('a' in s_ or 'p' in s_)) or s_ in [HRS.get(k) for k in HRS] or s_.startswith('Barton') : kind='station_label'
    elif 'Rincon' in s_ or 'restroom' in s_: kind='poi_label'
    pes=t.get_path_effects();halo=None
    for q in pes:
        g=getattr(q,'_gc',{}) or {}
        if 'linewidth' in g: halo=dict(width=float(g['linewidth']),color=matplotlib.colors.to_hex(g.get('foreground','white')))
    bp=t.get_bbox_patch();box=dict(fc=matplotlib.colors.to_hex(bp.get_facecolor()),alpha=float(bp.get_facecolor()[3])) if bp is not None else None
    leader=None
    if hasattr(t,'arrow_patch') and t.arrow_patch is not None:
        V=t.arrow_patch.get_path().vertices
        try: V=t.arrow_patch.get_transform().transform(V)
        except Exception: pass
        leader=dict(coords=_ll(ax.transData.inverted().transform(V)),color=matplotlib.colors.to_hex(t.arrow_patch.get_edgecolor()),lw=float(t.arrow_patch.get_linewidth()))
    f=_pt((cx_,cy_),kind=kind,text=s_,fs=float(t.get_fontsize()),color=matplotlib.colors.to_hex(t.get_color()),alpha=t.get_alpha(),weight=str(t.get_weight()),style=t.get_style(),family=t.get_family()[0],rotation=float(t.get_rotation()),linespacing=(t._linespacing if isinstance(t._linespacing,(int,float)) else 1.2),halo=halo,box=box,ha=t.get_ha(),width_pt=float(bb.width*72/fig.dpi),height_pt=float(bb.height*72/fig.dpi))
    if leader: f['properties']['leader']=leader
    _lab.append(f)
_w('labels.geojson',_fc(_lab))
print('EXPORT labels',len(_lab),'curved',len(CURV_OUT),'arrows',len(_arf))
# hillshade rasters (the one raster layer)
_hs={}
for nm_,a_ in [('main',ax)]+[(k,m) for (m,_),k in zip(MINIS,ORDER)]:
    im=[i for i in a_.images if i.get_zorder()==0][0];A=np.asarray(im.get_array());x0,x1,y0,y1=im.get_extent()
    A=(np.clip(A,0,1)*255).astype('uint8') if A.dtype!=np.uint8 else A
    _PI.fromarray(A[...,:3]).save(f'{_OUT}/hillshade/{nm_}.jpg',quality=84,optimize=True,progressive=True)
    _hs[nm_]=dict(file=f'hillshade/{nm_}.jpg',bounds_3857=[float(x0),float(y0),float(x1),float(y1)],sw=_ll1((x0,y0)),ne=_ll1((x1,y1)),px=[int(A.shape[1]),int(A.shape[0])],alpha=im.get_alpha())
# layout / views
_fb=lambda a_:[float(v) for v in a_.get_position().bounds]
_X0,_X1=ax.get_xlim();_Y0,_Y1=ax.get_ylim()
_views={'main':dict(x=[float(_X0),float(_X1)],y=[float(_Y0),float(_Y1)],sw=_ll1((_X0,_Y0)),ne=_ll1((_X1,_Y1)),fig=_fb(ax))}
for (m,_),k in zip(MINIS,ORDER): _views[k]=dict(x=list(map(float,m.get_xlim())),y=list(map(float,m.get_ylim())),sw=_ll1((m.get_xlim()[0],m.get_ylim()[0])),ne=_ll1((m.get_xlim()[1],m.get_ylim()[1])),fig=_fb(m))
_sb=dict(m5=float(m5),x=float(_X0+(_X1-_X0)*0.03),y=float(_Y0+(_Y1-_Y0)*.035))
_w('layout.json',dict(page_in=[36,24],views=_views,hillshade=_hs,legend_axes=(lambda a,b:[(a.x0-b.x0)/b.width,(a.y0-b.y0)/b.height,a.width/b.width,a.height/b.height])(lg.get_position(),ax.get_position()),logo=_fb(lo),title=_fb(tt),elev=_fb(ev),elev_xlim=list(map(float,ev.get_xlim())),elev_ylim=list(map(float,ev.get_ylim())),strips=dict(rx=RX,top=Y_TOP,rh=RH,w=0.51,xlim=[-12,77.5]),scalebar=_sb,header=[dict(text=t.get_text(),fs=t.get_fontsize(),x=t.get_position()[0],y=t.get_position()[1]) for t in tt.texts]))
# profiles
for (d_,e_),k in zip(EVC,ORDER):
    i_=np.unique(np.r_[np.linspace(0,len(d_)-1,min(len(d_),1500)).astype(int)])
    _w(f'profiles/{k}.json',dict(course=k,mi=[round(float(v),3) for v in np.asarray(d_)[i_]],ft=[round(float(v)) for v in np.asarray(e_)[i_]]))
_w('profiles/callouts.json',dict(callouts=EVCALL,rincon=[dict(mi=r_[3],ft=r_[4]) for r_ in ELT if r_[0]=='Rincon']))
print('EXPORT done')
