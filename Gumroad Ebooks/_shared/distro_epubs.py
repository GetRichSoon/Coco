import sys,pathlib,re,html
sys.path.insert(0,str(pathlib.Path(__file__).parent))
import final4_build as F
BB=F.BB; ROOT=BB.ROOT
NEW={'01':('chatgpt-workflows-small-business','01 AI Workflow Playbook','01_AI_Workflow_Playbook_Portrait_Cover.png'),
 '02':('client-acquisition-playbook','02 Client Acquisition Playbook','02_Client_Acquisition_Playbook_Portrait_Cover.png'),
 '03':('python-automation-for-beginners','03 Python Automation','03_Python_Automation_Portrait_Cover.png'),
 '04':('practical-money-system-beginners','04 Practical Money System','04_Practical_Money_System_Portrait_Cover.png'),
 '05':('job-interview-playbook-100-questions','05 Job Interview Playbook','05_Job_Interview_Playbook_Portrait_Cover.png')}
EPUBNAME={'01':'01_The_AI_Workflow_Playbook.epub','02':'02_The_Client_Acquisition_Playbook.epub','03':'03_Python_Automation_for_Beginners.epub','04':'04_The_Practical_Money_System.epub','05':'05_The_Job_Interview_Playbook.epub'}
def run(k):
    slug,folder,cov=NEW[k]; b=BB.BOOKS[k]; d=ROOT/folder
    txt=BB.load(b)
    m=dict(epub=html.unescape(' '.join(b['title'])).title() if False else {'01':'The AI Workflow Playbook','02':'The Client Acquisition Playbook','03':'Python Automation for Beginners','04':'The Practical Money System','05':'The Job Interview Playbook'}[k],
           sub=html.unescape(b['sub']),note=b['note'])
    # strip legacy intro block heading duplicates handled by builder
    fp=F.build_epub(slug,txt=txt,m=m,d=d,src=d,coverp=d/cov,outname=EPUBNAME[k])
    rc,o=F.validate_epub(fp); print(k,fp.name,fp.stat().st_size//1024,'KB','epubcheck rc',rc); print(o[-700:])
if __name__=='__main__':
    for k in (sys.argv[1:] or NEW): run(k)
