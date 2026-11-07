# Recomposes each supplied portrait cover into 1280x720 and 600x600 PNGs by re-using crops of the
# original artwork (title block + illustration) on an extended, blurred copy of the cover background.
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
import os,sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# name: (folder, portrait file, title_block (y0,y1), title_only_end, illustration (y0,y1))
B={
 '01_AI_Workflow_Playbook':('01 AI Workflow Playbook',(20,760),625,(740,1420)),
 '02_Client_Acquisition_Playbook':('02 Client Acquisition Playbook',(25,740),590,(730,1536)),
 '03_Python_Automation':('03 Python Automation',(40,752),615,(745,1536)),
 '04_Practical_Money_System':('04 Practical Money System',(20,790),630,(790,1470)),
 '05_Job_Interview_Playbook':('05 Job Interview Playbook',(10,855),655,(835,1536)),
}
def feather(w,h,l=0,r=0,t=0,b=0):
    m=Image.new('L',(w,h),255); d=ImageDraw.Draw(m)
    for i in range(l): d.line([(i,0),(i,h)],fill=int(255*i/l))
    for i in range(r): d.line([(w-1-i,0),(w-1-i,h)],fill=min(int(255*i/r),d.getpixel((w-1-i,h//2)) if False else int(255*i/r)))
    return m
def mask(w,h,l=0,r=0,t=0,b=0):
    import numpy as np
    x=np.ones((h,w),dtype=float)
    if l: x*=np.clip(np.arange(w)/l,0,1)[None,:]
    if r: x*=np.clip((w-1-np.arange(w))/r,0,1)[None,:]
    if t: x*=np.clip(np.arange(h)/t,0,1)[:,None]
    if b: x*=np.clip((h-1-np.arange(h))/b,0,1)[:,None]
    return Image.fromarray((x*255).astype('uint8'),'L')
def bg(cov,W,H,dark=.85):
    s=max(W/cov.width,H/cov.height)*1.3
    im=cov.resize((int(cov.width*s),int(cov.height*s)),Image.LANCZOS)
    im=im.crop(((im.width-W)//2,(im.height-H)//2+int(H*.1),(im.width-W)//2+W,(im.height-H)//2+int(H*.1)+H))
    im=im.filter(ImageFilter.GaussianBlur(38))
    return ImageEnhance.Brightness(im).enhance(dark)
def paste(canvas,crop,x,y,m):
    canvas.paste(crop,(x,y),m)
import numpy as np
def edges(cov):
    a=np.asarray(cov).astype(float)
    return a[:,0:8,:].mean(1), a[:,-8:,:].mean(1)   # per-row left / right edge colour
def rowcol(E,src):
    src=np.clip(src,0,E.shape[0]-1).astype(int); return E[src]
def smooth(a,k=25):
    from scipy.ndimage import gaussian_filter1d
    return gaussian_filter1d(a,k,axis=0,mode='nearest')
def make_bg(W,H,Lc,Rc):
    x=np.linspace(0,1,W)[None,:,None]; x=x*x*(3-2*x)
    bg=Lc[:,None,:]*(1-x)+Rc[:,None,:]*x
    rng=np.random.default_rng(1); bg=bg+rng.normal(0,1.2,bg.shape)
    return Image.fromarray(np.clip(bg,0,255).astype('uint8'))
def landscape(key):
    f,tb,to,ib=B[key]; cov=Image.open(f'{ROOT}/{f}/{key[:2]}_{"_".join(key.split("_")[1:])}_Portrait_Cover.png').convert('RGB')
    W,H=1280,720
    ill=cov.crop((0,ib[0],1024,ib[1])); iw=730; ih=int(ill.height*iw/ill.width)
    if ih>H-40: ih=H-40; iw=int(ill.width*ih/ill.height)
    ill=ill.resize((iw,ih),Image.LANCZOS); ix=W-iw; iy=(H-ih)//2
    t=cov.crop((0,tb[0],1024,tb[1])); tw=640; th=int(t.height*tw/t.width)
    if th>H-30: th=H-30; tw=int(t.width*th/t.height)
    t=t.resize((tw,th),Image.LANCZOS); ty=(H-th)//2
    EL,ER=edges(cov); ys=np.arange(H)
    Lc=smooth(rowcol(EL,tb[0]+(ys-ty)*1024/tw)); Rc=smooth(rowcol(ER,ib[0]+(ys-iy)*1024/iw))
    c=make_bg(W,H,Lc,Rc)
    if key.startswith('05'):
        a=np.asarray(c).astype(float); w=np.clip((np.arange(H)-(ty+th-10))/80,0,1)[:,None,None]*.9; a=a*(1-w)+np.array([9,16,38])*w; c=Image.fromarray(a.astype('uint8'))
    paste(c,ill,ix,iy,mask(iw,ih,l=170,t=40,b=40))
    paste(c,t,0,ty,mask(tw,th,r=90,t=24,b=6))
    return c
def square(key):
    f,tb,to,ib=B[key]; cov=Image.open(f'{ROOT}/{f}/{key[:2]}_{"_".join(key.split("_")[1:])}_Portrait_Cover.png').convert('RGB')
    S=600
    t=cov.crop((0,tb[0],1024,to)); tw=560; th=int(t.height*tw/t.width); t=t.resize((tw,th),Image.LANCZOS)
    ill=cov.crop((0,ib[0],1024,ib[1])); iw=470; ih=int(ill.height*iw/ill.width); ill=ill.resize((iw,ih),Image.LANCZOS)
    ty=14; iy=max(S-ih-4,ty+th-30)
    EL,ER=edges(cov); ys=np.arange(S)
    Lt=rowcol(EL,tb[0]+(ys-ty)*1024/tw); Rt=rowcol(ER,tb[0]+(ys-ty)*1024/tw)
    Li=rowcol(EL,ib[0]+(ys-iy)*1024/iw); Ri=rowcol(ER,ib[0]+(ys-iy)*1024/iw)
    w=np.clip((ys-(ty+th-40))/60,0,1)[:,None]
    Lc=smooth(Lt*(1-w)+Li*w,10); Rc=smooth(Rt*(1-w)+Ri*w,10)
    c=make_bg(S,S,Lc,Rc)
    paste(c,ill,(S-iw)//2,iy,mask(iw,ih,l=70,r=70,t=70))
    paste(c,t,(S-tw)//2,ty,mask(tw,th,b=18,l=10,r=10))
    return c
if __name__=='__main__':
    keys=sys.argv[1:] or list(B)
    for k in keys:
        f=B[k][0]
        landscape(k).save(f'{ROOT}/{f}/{k}_Landscape_1280x720.png')
        square(k).save(f'{ROOT}/{f}/{k}_Thumbnail_600x600.png')
        print('ok',k)
