# side-by-side: reference (left) vs ours (right) at given seconds
import sys, subprocess, os
from PIL import Image
REF='/agent/stored_files/cmuz3ocoq026006ad3erveuii_VID_20261008_110228_262.mp4'
secs=sys.argv[1:]
tiles=[]
for s in secs:
    rp=f'/tmp/ref_{s}.png'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',s,'-i',REF,'-frames:v','1','-vf','scale=405:720',rp])
    ours=Image.open(f'out/stills/Invite-{s.replace(".","_")}.png').convert('RGB').resize((405,720))
    pair=Image.new('RGB',(820,720),'white'); pair.paste(Image.open(rp).convert('RGB'),(0,0)); pair.paste(ours,(415,0)); tiles.append(pair)
cols=min(3,len(tiles)); rows=(len(tiles)+cols-1)//cols
out=Image.new('RGB',(cols*830,rows*730),'#333')
for i,t in enumerate(tiles): out.paste(t,((i%cols)*830,(i//cols)*730))
out.save('/tmp/compare.jpg',quality=85)
