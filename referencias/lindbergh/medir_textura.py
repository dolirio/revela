# Mede, na v1 real: (a) grão: amplitude por tom e tamanho (autocorrelação); (b) clarity: ganho de contraste local vs base calibrada
import rawpy,numpy as np,cv2,sys,os
from PIL import Image, ImageOps
Image.MAX_IMAGE_PIXELS=None
S=os.environ.get('LB_DIR', os.path.dirname(os.path.abspath(__file__)))
c=np.load(S+'/curve_v1.npz'); w,e,mu=c['w'],c['edges'],c['mu']; ok=~np.isnan(mu); xc=((e[:-1]+e[1:])/2)[ok]; mu=mu[ok]
def base(raf,half=True):
    with rawpy.imread(raf) as R:
        lin=R.postprocess(half_size=half,gamma=(1,1),no_auto_bright=True,output_bps=16,use_camera_wb=True).astype(np.float32)/65535
    return np.interp(np.log2(lin@w.astype(np.float32)+1e-6),xc,mu).astype(np.float32)
res={}
for k,jn in [('DSCF0660','DSCF0660(1).jpg'),('DSCF0670','DSCF0670(1).jpg'),('DSCF0675','DSCF0675(1).jpg')]:
    j=np.asarray(ImageOps.exif_transpose(Image.open(f'{S}/v1/{jn}')).convert('L'),np.float32)/255
    # grão: resíduo de alta frequência em regiões planas
    hp=j-cv2.GaussianBlur(j,(0,0),2.5)
    lo=cv2.GaussianBlur(j,(0,0),2.5)
    # planura: gradiente baixo da imagem bem desfocada
    sm=cv2.GaussianBlur(j,(0,0),8); g=np.hypot(cv2.Sobel(sm,cv2.CV_32F,1,0),cv2.Sobel(sm,cv2.CV_32F,0,1))
    flat=g<np.percentile(g,30)
    bins=np.linspace(0,1,11); amp=[]
    for a,b in zip(bins[:-1],bins[1:]):
        m=flat&(lo>=a)&(lo<b); amp.append(hp[m].std()*255 if m.sum()>5000 else np.nan)
    # autocorrelação do grão num recorte plano grande
    ys,xs=np.where(flat[::64,::64]); y0,x0=ys[len(ys)//2]*64,xs[len(xs)//2]*64
    cr=hp[max(0,y0-256):y0+256,max(0,x0-256):x0+256]; cr=cr-cr.mean()
    F=np.fft.fft2(cr); ac=np.real(np.fft.ifft2(F*np.conj(F))); ac/=ac[0,0]
    r=[ac[0,d] for d in range(5)]
    # clarity: contraste local em banda média (sigma 4..32 px no half-size) v1 vs base
    B=base(f'{S}/raf/{k}.RAF')
    jh=cv2.resize(j,(B.shape[1],B.shape[0]),interpolation=cv2.INTER_AREA)
    band=lambda x: cv2.GaussianBlur(x,(0,0),4)-cv2.GaussianBlur(x,(0,0),32)
    bj,bb=band(jh),band(B); gain=(bj*bb).sum()/(bb*bb).sum()
    res[k]=(amp,r,gain)
    print(k,'grão por tom (0-1 em 10 faixas):',[None if np.isnan(x) else round(float(x),1) for x in amp])
    print('   autocorr lag0..4:',np.round(r,2),' ganho banda média v1/base:',round(float(gain),3),flush=True)
