# Builds comparison sheets and objective readability metrics for the cover concepts of the original four books.
import pathlib,glob,sys,re,json
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import old4_covers_v3 as V3
ROOT=V3.ROOT
def lum(hexc):
    h=hexc.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c:c/12.92 if c<=.03928 else ((c+.055)/1.055)**2.4
    return .2126*f(r)+.7152*f(g)+.0722*f(b)
def contrast(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+.05)/(lo+.05)
def bg_color(bg):
    cols=re.findall(r'#[0-9a-fA-F]{6}',bg); return cols[0] if cols else '#000000'
def font(sz):
    for f in ('arialbd.ttf','segoeuib.ttf','arial.ttf'):
        try: return ImageFont.truetype(f,sz)
        except Exception: pass
    return ImageFont.load_default()
def sheet(slug):
    S=V3.C[slug]; d=ROOT/slug; out=d/'04_cover_tests'; out.mkdir(exist_ok=True)
    live=Image.open(next(iter(glob.glob(str(d/'01_live_assets_as_found'/'live_thumbnail.*'))))).convert('RGB')
    liveP=Image.open(d/'00_original_backup'/'cover.jpg').convert('RGB')
    items=[('ORIGINAL (live)',liveP,live)]
    for cid in 'ABC':
        p=d/'03_improved'/'covers_v3'/f'concept_{cid}'
        items.append((f'CONCEPT {cid}: '+S[cid]['name'],Image.open(p/'cover_portrait_1600x2560.png').convert('RGB'),Image.open(p/'thumbnail_square_600x600.png').convert('RGB')))
    W=4*400+20; H=520+240+150+60
    m=Image.new('RGB',(W,H),(236,236,236)); dr=ImageDraw.Draw(m)
    for i,(lab,por,sq) in enumerate(items):
        x=10+i*400
        m.paste(por.resize((320,512)),(x,10)); m.paste(sq.resize((240,240)),(x,540)); m.paste(sq.resize((120,120)),(x+262,540)); m.paste(sq.resize((70,70)),(x+262,670))
        dr.text((x,790),lab[:42],fill=(20,20,20),font=font(13))
        dr.text((x,810),'cover | square 240px | phone 120px / 70px',fill=(90,90,90),font=font(11))
    m.save(out/'compare_original_vs_concepts.png')
    rows=[]; mt=S['meta']
    for cid in 'ABC':
        c=S[cid]; bgc=bg_color(c['bg'])
        cr=contrast(c['t'],bgc); kr=contrast(c['k'],bgc); tr=contrast(c['tg'],bgc)
        lines=len(mt['main'])+(1 if mt['sub2'] else 0)
        title_h_160=round(mt['fs']*160/1600*lines*1.02)
        title_h_sq120=round(mt['fs']*.36*lines*120/600)
        rows.append((cid,c['name'],round(cr,1),round(kr,1),round(tr,1),title_h_160,title_h_sq120))
    return rows
if __name__=='__main__':
    allrows={}
    for s in V3.C: allrows[s]=sheet(s); print('sheet',s)
    json.dump(allrows,open(ROOT/'cover_test_metrics.json','w'),indent=1)
