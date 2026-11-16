"""Emulação da receita PB Lindbergh a partir do RAW da X-T50.
Calibrado contra a conversão real da v1 (X RAW Studio, C1 do usuário).
Parâmetros: ver RECEITAS. Medidos: mistura de canais, curva base (v1), grão v1, clarity -1.
Estimados (sem medição direta): tamanho de cada passo de Highlight/Shadow, nitidez."""
import rawpy,numpy as np,cv2,sys,os
from PIL import Image
S=os.environ.get('LB_DIR', os.path.dirname(os.path.abspath(__file__)))
c=np.load(S+'/curve_v1.npz'); W=c['w'].astype(np.float32); e=c['edges']; mu=c['mu']; ok=~np.isnan(mu)
XC=((e[:-1]+e[1:])/2)[ok]; MU=mu[ok]
# grão medido na v1 (desvio do resíduo passa-alta σ2.5, em 0-1) por faixa de tom
GT=np.linspace(0.05,0.95,10); GA=np.array([17.0,20.1,20.3,20.0,19.6,19.3,18.6,17.5,15.3,11.9])/255
CLAR_V1=0.987           # medido: banda média (σ8–64 px) da base × 0.987 = v1 real (energia, independente de alinhamento)
CLAR_STEP=0.094          # estimado: variação por passo de Clarity na banda média
TOM_OFFSET=1.8/255       # medido: emulação ficava 1,8 nível mais escura que a v1 real
TONE_STEP=0.035          # estimado: deslocamento máx. por passo de H/S (0-1)
RECEITAS={
 'v1':dict(H=0,S=-1,clar=-1,grain_sigma=0.0,sharp=1),
 'v2':dict(H=-1,S=0,clar=+1,grain_sigma=1.1,sharp=0),
 # v3 (escolha do usuário em 16/11): grão orgânico C com a força da v2; sombras como a v1 (S −1)
 'v3':dict(H=-1,S=-1,clar=+1,grain='organico',forca=1.0,sharp=0),
}
def bump(x,c,wd): return np.exp(-0.5*((x-c)/wd)**2)
def tom(L,H,S0):
    # a curva base JÁ contém H0/S-1 (v1). Aplica só a diferença.
    dS=S0-(-1); dH=H-0
    L=L - dS*TONE_STEP*bump(L,0.22,0.10)*(1-L)   # sombra +: escurece sombras
    L=L + dH*TONE_STEP*bump(L,0.80,0.10)*L       # alta luz -: escurece/contém altas luzes
    return L
def grao(L,sigma,rng):
    n=rng.standard_normal(L.shape,dtype=np.float32)
    if sigma>0: n=cv2.GaussianBlur(n,(0,0),sigma)
    n/=n.std()
    if sigma>0:
        # Grão grande: casar a VISIBILIDADE, não o desvio por pixel. Em escala de visualização (desfoque σ1,5),
        # ruído branco perde ~5x e ruído agrupado (σ1,1) perde ~1,7x; com o mesmo desvio por pixel, o Large
        # ficaria ~3x mais visível que o Small. Escolha (julgamento, não medição): Large = 1,5x o Small visível.
        vis_small=1/(2*np.sqrt(np.pi)*1.5); vis_large=sigma/np.sqrt(sigma**2+1.5**2)
        n*=1.5*vis_small/vis_large
    A=np.interp(L,GT,GA).astype(np.float32)
    return L+A*n
def grao_organico(L,forca,rng):
    """Grão com aspecto de filme: aglomerados de 3 tamanhos somados + caudas pesadas (alguns grãos bem marcados).
    'forca' só muda a quantidade; o caráter (tamanhos, irregularidade) fica igual. 1,0 = mesma visibilidade da v2."""
    oct_=[(0.6,0.45),(1.2,0.40),(2.4,0.15)]
    n=sum(w*(lambda x:x/x.std())(cv2.GaussianBlur(rng.standard_normal(L.shape,dtype=np.float32),(0,0),s)) for s,w in oct_)
    n=np.sign(n)*np.abs(n)**1.35; n/=n.std()
    vis_small=1/(2*np.sqrt(np.pi)*1.5); alvo=1.5*vis_small
    n*=alvo/cv2.GaussianBlur(n,(0,0),1.5).std()
    A=np.interp(L,GT,GA).astype(np.float32)
    return L+forca*A*n
def revelar(raf,rec,seed=0):
    with rawpy.imread(raf) as R:
        lin=R.postprocess(gamma=(1,1),no_auto_bright=True,output_bps=16,use_camera_wb=True).astype(np.float32)/65535
    L=np.interp(np.log2(lin@W+1e-6),XC,MU).astype(np.float32); del lin
    L=tom(L+TOM_OFFSET,rec['H'],rec['S'])
    # recorte central igual ao do X RAW Studio (7728×5152)
    H,Wd=L.shape; th,tw=(7728,5152) if H>Wd else (5152,7728)
    y0,x0=(H-th)//2,(Wd-tw)//2; L=np.ascontiguousarray(L[y0:y0+th,x0:x0+tw])
    # clarity: âncora medida na v1 (Clarity −1); cada passo acima soma CLAR_STEP
    k=CLAR_V1*(1+(rec['clar']-(-1))*CLAR_STEP)
    lp=cv2.GaussianBlur(L,(0,0),8)-cv2.GaussianBlur(L,(0,0),64)
    L=L+(k-1)*lp
    # nitidez (estimada): USM raio 1 px
    amt={-1:0.15,0:0.35,1:0.6}[rec['sharp']]
    L=L+amt*(L-cv2.GaussianBlur(L,(0,0),1.0))
    rng=np.random.default_rng(seed)
    if rec.get('grain')=='organico': L=grao_organico(np.clip(L,0,1),rec.get('forca',1.0),rng)
    else: L=grao(np.clip(L,0,1),rec['grain_sigma'],rng)
    return (np.clip(L,0,1)*255+0.5).astype(np.uint8)
if __name__=='__main__':
    rec=sys.argv[1]; out=sys.argv[2]
    for raf in sys.argv[3:]:
        k=os.path.basename(raf)[:-4]
        img=revelar(raf,RECEITAS[rec],seed=hash(k)%2**32)
        Image.fromarray(img).save(f'{out}/{k}_Lindbergh_{rec}.jpg',quality=93,subsampling=0)
        print(k,flush=True)
