import numpy as np,cv2,sys
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS=None
def stats(j):
    hp=j-cv2.GaussianBlur(j,(0,0),2.5); lo=cv2.GaussianBlur(j,(0,0),2.5)
    sm=cv2.GaussianBlur(j,(0,0),8); g=np.hypot(cv2.Sobel(sm,cv2.CV_32F,1,0),cv2.Sobel(sm,cv2.CV_32F,0,1)); fl=g<np.percentile(g,30)
    b=np.linspace(0,1,6); return [round(float(hp[fl&(lo>=a)&(lo<c)].std()*255),1) if (fl&(lo>=a)&(lo<c)).sum()>5000 else None for a,c in zip(b[:-1],b[1:])]
for k in sys.argv[1:]:
    real=np.asarray(ImageOps.exif_transpose(Image.open(f'v1/{k}(1).jpg')).convert('L'),np.float32)/255
    emu=np.asarray(Image.open(f'out_v1e/{k}_Lindbergh_v1.jpg'),np.float32)/255
    assert emu.shape==real.shape, (emu.shape, real.shape)
    bl=lambda x: cv2.resize(cv2.GaussianBlur(x,(0,0),12),(real.shape[1]//16,real.shape[0]//16),interpolation=cv2.INTER_AREA)
    d=(bl(emu)-bl(real))*255
    band=lambda x: cv2.GaussianBlur(x,(0,0),8)-cv2.GaussianBlur(x,(0,0),64)
    br,be=band(real),band(emu)
    print(k,'tom: viés',round(float(d.mean()),2),'RMS',round(float(np.sqrt((d**2).mean())),2),'| energia banda emu/real',round(float(be.std()/br.std()),3))
    print('   grão real',stats(real),' emu',stats(emu))
