# Landscape 1280x720 and square 600x600 recompositions of the final approved portrait covers (original four books).
import pathlib,numpy as np
from PIL import Image,ImageFilter,ImageEnhance
R=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four')
# crop boxes in the 1024x1536 cover: title block parts (list of (y0,y1)), illustration (y0,y1)
BGC={'where-your-aws-bill-goes':((6,22,52),(3,12,32)),'retake-exam-technique':((9,26,60),(4,14,36)),'keep-your-own-books':((10,52,34),(4,30,20)),'aswb-clinical-90-day-study-plan':((9,30,70),(4,16,42))}
CFG={
 'where-your-aws-bill-goes':dict(title=[(20,606)],ill=(596,1345),name='WhereYourAWSBillGoes'),
 'retake-exam-technique':dict(title=[(20,722)],ill=(722,1340),name='TheRetakeMethod'),
 'keep-your-own-books':dict(title=[(40,622)],ill=(622,1175),extra=[(1182,1385)],name='KeepYourOwnBooks'),
 'aswb-clinical-90-day-study-plan':dict(title=[(40,742)],ill=(742,1340),name='90DayStudyPlan'),
}
def mask(w,h,l=0,r=0,t=0,b=0):
    x=np.ones((h,w),float)
    if l: x*=np.clip(np.arange(w)/l,0,1)[None,:]
    if r: x*=np.clip((w-1-np.arange(w))/r,0,1)[None,:]
    if t: x*=np.clip(np.arange(h)/t,0,1)[:,None]
    if b: x*=np.clip((h-1-np.arange(h))/b,0,1)[:,None]
    return Image.fromarray((x*255).astype('uint8'),'L')
def bg(cov,W,H,dark=.72):
    s=max(W/cov.width,H/cov.height)*1.25; im=cov.resize((int(cov.width*s),int(cov.height*s)),Image.LANCZOS)
    cx=(im.width-W)//2; cy=int((im.height-H)*.42); im=im.crop((cx,cy,cx+W,cy+H)).filter(ImageFilter.GaussianBlur(34))
    return ImageEnhance.Brightness(im).enhance(dark)
def stack(cov,parts,width):
    crops=[cov.crop((0,a,1024,b)).resize((width,int((b-a)*width/1024)),Image.LANCZOS) for a,b in parts]
    h=sum(c.height for c in crops); out=Image.new('RGB',(width,h)); y=0
    for c in crops: out.paste(c,(0,y)); y+=c.height
    return out
def panel(img,W,H,y0=None):
    """Place img (width W) on a W x H canvas, extending its top and bottom edge colours smoothly."""
    a=np.asarray(img).astype(float); h=a.shape[0]
    if y0 is None: y0=(H-h)//2
    can=np.zeros((H,W,3),float)
    top=a[:6].mean(0); bot=a[-6:].mean(0)
    from scipy.ndimage import gaussian_filter1d
    top=gaussian_filter1d(top,30,axis=0,mode='nearest'); bot=gaussian_filter1d(bot,30,axis=0,mode='nearest')
    for y in range(H):
        if y<y0: can[y]=top*(0.92+0.08*y/max(1,y0))
        elif y>=y0+h: can[y]=bot*(1-0.12*(y-y0-h)/max(1,H-y0-h))
    can[max(y0,0):y0+h]=a[:H-max(y0,0)] if y0>=0 else a
    # blend the seam rows
    for k in range(24):
        w=k/24
        if y0+k<H and y0+k>=0: can[y0+k]=can[y0+k]*w+top*(1-w)
        yy=y0+h-1-k
        if 0<=yy<H: can[yy]=can[yy]*w+bot*(1-w)
    return Image.fromarray(np.clip(can,0,255).astype('uint8'))
def gradient(W,H,lc,rc):
    x=np.linspace(0,1,W)[None,:,None]; x=x*x*(3-2*x)
    y=np.linspace(0,1,H)[:,None,None]
    base=np.array(lc)[None,None,:]*(1-x)+np.array(rc)[None,None,:]*x
    vig=1-0.35*((x-.5)**2*4+(y-.5)**2*4)/2
    return Image.fromarray(np.clip(base*vig*0.85,0,255).astype('uint8'))
def meancol(im): return tuple(np.asarray(im).astype(float).mean((0,1)))
def landscape(slug):
    c=CFG[slug]; cov=Image.open(R/slug/'05 APPROVED PORTRAIT COVER'/'cover_final_1024x1536.png').convert('RGB'); W,H=1280,720
    parts=c['title']+c.get('extra',[]); tw=640; t=stack(cov,parts,tw)
    if t.height>H-20: tw=int(tw*(H-20)/t.height); t=stack(cov,parts,tw)
    ill=cov.crop((0,c['ill'][0],1024,c['ill'][1])); iw=630; ih=int(ill.height*iw/1024)
    if ih>H-20: ih=H-20; iw=int(1024*ih/ill.height)
    ill=ill.resize((iw,ih),Image.LANCZOS)
    can=gradient(W,H,BGC[slug][0],BGC[slug][1]); can=Image.fromarray(np.clip(np.asarray(can).astype(float)/0.85*1.0,0,255).astype('uint8'))
    can.paste(t,(20,(H-t.height)//2),mask(tw,t.height,l=50,r=50,t=50,b=50))
    can.paste(ill,(W-iw-14,(H-ih)//2),mask(iw,ih,l=60,r=60,t=60,b=60))
    return can
def square(slug):
    c=CFG[slug]; cov=Image.open(R/slug/'05 APPROVED PORTRAIT COVER'/'cover_final_1024x1536.png').convert('RGB'); S=600
    t=stack(cov,c['title'],560); ill=cov.crop((0,c['ill'][0],1024,c['ill'][1]))
    iw={'where-your-aws-bill-goes':360,'retake-exam-technique':340,'aswb-clinical-90-day-study-plan':340,'keep-your-own-books':380}[slug]
    ih=int(ill.height*iw/1024); ill=ill.resize((iw,ih),Image.LANCZOS)
    total=t.height+ih-14; y0=max(6,(S-total)//2)
    tc=BGC[slug][0]; bc=BGC[slug][1]
    can=np.zeros((S,S,3),float)
    for y in range(S): can[y]=(np.array(tc)*(1-y/S)+np.array(bc)*(y/S))*1.0
    img=Image.fromarray(can.astype('uint8'))
    img.paste(t,((S-560)//2,y0),mask(560,t.height,b=30,l=30,r=30,t=24))
    img.paste(ill,((S-iw)//2,y0+t.height-14),mask(iw,ih,l=70,r=70,t=50,b=40))
    return img
if __name__=='__main__':
    for slug,c in CFG.items():
        d=R/slug
        for sub in ('06 LANDSCAPE COVER','07 SQUARE THUMBNAIL'): (d/sub).mkdir(exist_ok=True)
        landscape(slug).save(d/'06 LANDSCAPE COVER'/f'{c["name"]}_Landscape_1280x720.png')
        square(slug).save(d/'07 SQUARE THUMBNAIL'/f'{c["name"]}_Thumbnail_600x600.png'); print('ok',slug)
