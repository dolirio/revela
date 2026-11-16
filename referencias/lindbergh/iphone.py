"""Aplica a receita Lindbergh v3 a fotos já processadas (HEIC do iPhone, Display P3).
Entrada: .rgba + .json gerados por iph/dec.mjs (libheif do próprio app)."""
import numpy as np,cv2,json,sys,os
from PIL import Image
import lindbergh as LB
P3_TO_SRGB=np.array([[1.2249,-0.2247,0.0],[-0.0420,1.0419,0.0],[-0.0197,-0.0786,1.0979]],np.float32)
def srgb_lin(v): return np.where(v<=0.04045,v/12.92,((v+0.055)/1.055)**2.4)
# âncora de exposição: o cinza médio do iPhone (0,18 linear) cai onde a curva da v1 entrega cinza médio (L≈0,46)
X0=float(np.interp(0.46,LB.MU,LB.XC))
def revelar(path,rec):
    m=json.load(open(path+'.json')); a=np.fromfile(path+'.rgba',np.uint8).reshape(m['h'],m['w'],4)[...,:3].astype(np.float32)/255
    lin=srgb_lin(a)@P3_TO_SRGB.T; lin=np.clip(lin,0,None)
    esc=max(lin.shape[:2])/7728          # tamanho relativo ao quadro (X-T50 = 1)
    L=np.interp(np.log2(lin@LB.W+1e-6)+(X0-np.log2(0.18)),LB.XC,LB.MU).astype(np.float32); del lin,a
    L=LB.tom(L+LB.TOM_OFFSET,rec['H'],rec['S'])
    k=LB.CLAR_V1*(1+(rec['clar']+1)*LB.CLAR_STEP)
    L=L+(k-1)*(cv2.GaussianBlur(L,(0,0),8*esc)-cv2.GaussianBlur(L,(0,0),64*esc))
    # sem nitidez extra: o iPhone já aplica a dele
    rng=np.random.default_rng(abs(hash(path))%2**32)
    L=LB.grao_organico(np.clip(L,0,1),rec.get('forca',1.0),rng,escala=esc)
    return (np.clip(L,0,1)*255+0.5).astype(np.uint8)
if __name__=='__main__':
    out=sys.argv[1]; os.makedirs(out,exist_ok=True)
    for p in sys.argv[2:]:
        img=revelar(p,LB.RECEITAS['v3'])
        Image.fromarray(img).save(f'{out}/{os.path.basename(p)}_Lindbergh_v3.jpg',quality=93,subsampling=0)
        print(p,img.shape,'média',round(float(img.mean()),1),flush=True)
