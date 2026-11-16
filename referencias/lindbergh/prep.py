# Revela RAFs (half_size, linear) e reduz RAF e v1 ao mesmo grid pequeno, desfocado (remove grão/nitidez)
import rawpy,numpy as np,glob,os,sys
from PIL import Image, ImageOps
import cv2
Image.MAX_IMAGE_PIXELS=None
S=sys.argv[1]
mp={}
for p in glob.glob(S+'/v1/*.jpg'):
    n=os.path.basename(p)
    k='DSCF0658' if n=='DSCF0688(1).jpg' else n.split('(')[0]
    mp[k]=p
for raf in sorted(glob.glob(S+'/raf/*.RAF')):
    k=os.path.basename(raf)[:-4]; out=f'{S}/cache/{k}.npz'
    if os.path.exists(out): continue
    with rawpy.imread(raf) as R:
        lin=R.postprocess(half_size=True,gamma=(1,1),no_auto_bright=True,output_bps=16,use_camera_wb=True,output_color=rawpy.ColorSpace.sRGB).astype(np.float32)/65535
    j=np.asarray(ImageOps.exif_transpose(Image.open(mp[k])).convert('L'),dtype=np.float32)/255
    H,W=lin.shape[:2]; h,w=H//8,W//8
    ls=cv2.resize(cv2.GaussianBlur(lin,(0,0),3),(w,h),interpolation=cv2.INTER_AREA)
    js=cv2.resize(cv2.GaussianBlur(j,(0,0),6),(w,h),interpolation=cv2.INTER_AREA)
    np.savez(out,lin=ls,v1=js)
    print(k,ls.shape,js.shape,flush=True)
