"""Lindbergh v5 (retrato): metas medidas nas fotos dele.
 pele no cinza médio (alvo 135), rosto ≥ +60 acima da mediana da foto, luz e sombra dentro do rosto,
 textura fina suave (sem nitidez extra, clarity 0; a textura vem do grão)."""
import numpy as np,cv2,json,os,sys
from PIL import Image
import lindbergh as LB, iphone as IP
ROSTO={'IMG_7110':(0.30,0.26,0.46,0.40),'IMG_7115':(0.30,0.26,0.46,0.40),'IMG_7116':(0.40,0.32,0.56,0.46),'IMG_7117':(0.30,0.44,0.52,0.62)}
ALVO_PELE=135/255; CONTRASTE=1.25; ESCURECER=0.85   # paradas fora do rosto
def render(path,expo,box,burn=ESCURECER):
    m=json.load(open(path+'.json')); a=np.fromfile(path+'.rgba',np.uint8).reshape(m['h'],m['w'],4)[...,:3].astype(np.float32)/255
    lin=np.clip(IP.srgb_lin(a)@IP.P3_TO_SRGB.T,0,None); del a; esc=max(lin.shape[:2])/7728
    logY=np.log2(lin@LB.W+1e-6)+(IP.X0-np.log2(0.18)); del lin; H,W=logY.shape
    x0,y0,x1,y1=box; F=logY[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]; f=float(np.median(F))
    # contraste nos médios, centrado no rosto (abre luz e sombra dentro do rosto)
    logY=f+(logY-f)*CONTRASTE
    # máscara do rosto (elipse suave) -> resto da foto escurece, como na ampliação com máscara
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32); cx,cy=(x0+x1)/2*W,(y0+y1)/2*H; rx,ry=(x1-x0)*W*1.1,(y1-y0)*H*1.3
    face=np.exp(-0.5*(((xx-cx)/rx)**2+((yy-cy)/ry)**2)); del yy,xx
    logY=logY+expo-burn*(1-face)
    L=np.interp(logY,LB.XC,LB.MU).astype(np.float32); del logY
    L=LB.tom(L+LB.TOM_OFFSET,-1,+1)
    L=L+(LB.CLAR_V1-1)*(cv2.GaussianBlur(L,(0,0),8*esc)-cv2.GaussianBlur(L,(0,0),64*esc))  # clarity 0
    L=L-0.4*(L-cv2.GaussianBlur(L,(0,0),0.8*max(esc,0.6)))   # tira a "crocância" da nitidez do iPhone
    return L
def stats(L,box):
    H,W=L.shape; x0,y0,x1,y1=box; F=L[int(y0*H):int(y1*H),int(x0*W):int(x1*W)]*255
    return float(np.median(F)), float(np.median(L)*255), np.percentile(F,[10,90])
os.makedirs('out_iph_v5',exist_ok=True)
for k,box in ROSTO.items():
    p='iph/'+k; expo=0.0; burn=ESCURECER
    for it in range(6):                       # pele no alvo e rosto ≥ +60 acima da foto (escurece mais o entorno se preciso, até 2,5 paradas)
        L=render(p,expo,box,burn); fm,im,_=stats(L,box)
        expo+=np.log2(ALVO_PELE*255/max(fm,1))*0.9
        if fm-im<60 and burn<2.5: burn+=0.4
    L=render(p,expo,box,burn); fm,im,pr=stats(L,box)
    esc=max(L.shape)/7728
    L=LB.grao_organico(np.clip(L,0,1),1.0,np.random.default_rng(5),escala=esc)
    out=(np.clip(L,0,1)*255+0.5).astype(np.uint8)
    Image.fromarray(out).save(f'out_iph_v5/{k}_Lindbergh_v5.jpg',quality=93)
    print(f'{k}: entorno −{burn:.2f} paradas | exposição {expo:+.2f} paradas | pele {fm:.0f} | mediana da foto {im:.0f} | rosto−foto {fm-im:+.0f} | rosto p10–p90 {pr[0]:.0f}–{pr[1]:.0f}',flush=True)
