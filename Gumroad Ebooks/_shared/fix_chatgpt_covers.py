# Minimal accuracy fixes to the owner's approved ChatGPT covers (originals are preserved untouched in each book's "05 APPROVED PORTRAIT COVER" folder).
# AWS: remove the stray "BOOK 04" pill. Retake: replace the subtitle that promised success. ASWB: replace medical spine labels and soften medical hologram/caduceus (the exam is for social workers).
import cv2,numpy as np,pathlib
from PIL import Image,ImageDraw,ImageFont
D=pathlib.Path(r'C:\Users\Lenovo\Downloads')
R=pathlib.Path(r'C:\Users\Lenovo\Good Space\Coco\Gumroad Ebooks\Original Four')
SRC={'where-your-aws-bill-goes':'Where Your AWS Bill Goes.png','retake-exam-technique':'The Retake Method_ Aim Higher.png','keep-your-own-books':'Keep Your Own Books.png','aswb-clinical-90-day-study-plan':'90-Day Clinical Exam Study Plan.png'}
def cvread(p): return cv2.cvtColor(np.array(Image.open(p).convert('RGB')),cv2.COLOR_RGB2BGR)
def toimg(a): return Image.fromarray(cv2.cvtColor(a,cv2.COLOR_BGR2RGB))
def font(names,sz):
    for n in names:
        try: return ImageFont.truetype(n,sz)
        except Exception: pass
    return ImageFont.load_default()
def bright_mask(a,box,thr,dil=5):
    x0,y0,x1,y1=box; m=np.zeros(a.shape[:2],np.uint8); roi=cv2.cvtColor(a[y0:y1,x0:x1],cv2.COLOR_BGR2GRAY)
    m[y0:y1,x0:x1]=(roi>thr).astype(np.uint8)*255
    return cv2.dilate(m,np.ones((dil,dil),np.uint8))
def fix_aws(a):
    m=np.zeros(a.shape[:2],np.uint8); cv2.rectangle(m,(380,102),(648,166),255,-1)
    out=cv2.inpaint(a,m,6,cv2.INPAINT_TELEA)
    # smooth the filled area slightly so no scar remains
    reg=out[96:172,374:654]; out[96:172,374:654]=cv2.GaussianBlur(reg,(0,0),3)
    return out
def fix_retake(a):
    m=bright_mask(a,(150,570,935,712),150,9)
    out=cv2.inpaint(a,m,7,cv2.INPAINT_TELEA)
    img=toimg(out); dr=ImageDraw.Draw(img)
    f=font(['georgia.ttf','cambria.ttc','times.ttf'],50)
    lines=[[('Exam technique for candidates ',(255,255,255)),('retaking',(238,200,100))],[('a professional licensing exam',(255,255,255))]]
    y=592
    for ln in lines:
        w=sum(dr.textlength(t,font=f) for t,_ in ln); x=(1024-w)/2
        for t,c in ln:
            dr.text((x,y),t,font=f,fill=c); x+=dr.textlength(t,font=f)
        y+=70
    return cv2.cvtColor(np.array(img),cv2.COLOR_RGB2BGR)
def fix_aswb(a):
    out=a.copy()
    # spine text boxes (x0,y0,x1,y1) of the five labels, with approximate rotation
    spines=[((112,1018,310,1062),-.2,'Human Development'),((118,1085,230,1128),-.6,'Assessment'),((120,1145,250,1190),-.4,'Diagnosis'),((115,1205,300,1255),-.4,'Interventions'),((112,1262,285,1312),-.8,'Ethics')]
    # inpaint existing labels
    for box,_,_ in spines:
        x0,y0,x1,y1=box; m=bright_mask(out,(x0-10,y0-8,x1+40,y1+8),120,7)
        out=cv2.inpaint(out,m,5,cv2.INPAINT_TELEA)
    img=toimg(out)
    f=font(['georgia.ttf','cambria.ttc','times.ttf'],27)
    for (x0,y0,x1,y1),ang,txt in spines:
        w=int(ImageDraw.Draw(img).textlength(txt,font=f))+8; layer=Image.new('RGBA',(w+10,44),(0,0,0,0)); d=ImageDraw.Draw(layer)
        d.text((4,4),txt,font=f,fill=(222,230,240,255)); layer=layer.rotate(-ang,resample=Image.BICUBIC,expand=True)
        img.paste(layer,(x0+8,y0-2),layer)
    out=cv2.cvtColor(np.array(img),cv2.COLOR_RGB2BGR)
    # soften the medical hologram and the caduceus into a quiet glow
    for (x0,y0,x1,y1) in [(40,735,330,1012),(780,850,1010,1000)]:
        m=np.zeros(out.shape[:2],np.float32); cv2.ellipse(m,((x0+x1)//2,(y0+y1)//2),((x1-x0)//2,(y1-y0)//2),0,0,360,1,-1); m=cv2.GaussianBlur(m,(0,0),22)[...,None]
        bl=cv2.GaussianBlur(out,(0,0),26); bl=(bl.astype(np.float32)*0.80).clip(0,255)
        out=(out*(1-m)+bl*m).astype(np.uint8)
    return out
FIX={'where-your-aws-bill-goes':fix_aws,'retake-exam-technique':fix_retake,'aswb-clinical-90-day-study-plan':fix_aswb,'keep-your-own-books':lambda a:a}
if __name__=='__main__':
    for slug,fn in SRC.items():
        a=cvread(D/fn); out=FIX[slug](a)
        d=R/slug/'05 APPROVED PORTRAIT COVER'; d.mkdir(parents=True,exist_ok=True)
        import shutil; shutil.copy(D/fn,d/('chatgpt_original_'+fn.replace(' ','_')))
        im=toimg(out); im.save(d/'cover_final_1024x1536.png')
        im.resize((1800,2700),Image.LANCZOS).save(d/'cover_final_portrait_1800x2700.png')
        print('ok',slug)
