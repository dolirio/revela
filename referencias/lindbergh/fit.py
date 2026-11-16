import numpy as np,glob,os
from scipy.optimize import minimize
S=os.environ.get('LB_DIR', os.path.dirname(os.path.abspath(__file__)))
D={os.path.basename(p)[:-4]:np.load(p) for p in sorted(glob.glob(S+'/cache/*.npz'))}
# checagem de alinhamento: correlação de postos entre log(Y) e v1
for k,d in D.items():
    Y=d['lin']@[0.2126,0.7152,0.0722]
    c=np.corrcoef(np.log(Y.ravel()+1e-4),d['v1'].ravel())[0,1]
    if c<0.95: print('baixa correlação',k,round(c,3))
X=np.concatenate([d['lin'].reshape(-1,3) for d in D.values()]); T=np.concatenate([d['v1'].ravel() for d in D.values()])
m=(X.max(1)<0.98)&(X.min(1)>1e-4); X,T=X[m],T[m]
rng=np.random.default_rng(0); i=rng.choice(len(T),min(len(T),200000),replace=False); X,T=X[i],T[i]
edges=np.linspace(-9,0.5,96)
def curve(w):
    w=np.abs(w)/np.abs(w).sum(); y=np.log2(X@w+1e-6)
    b=np.clip(np.digitize(y,edges)-1,0,len(edges)-2)
    s=np.bincount(b,T,len(edges)-1); n=np.bincount(b,None,len(edges)-1)
    mu=np.where(n>0,s/np.maximum(n,1),np.nan); return w,y,b,mu,n
def loss(w):
    w,y,b,mu,n=curve(w); return np.nanmean((T-mu[b])**2)
best=minimize(loss,[0.3,0.6,0.1],method='Nelder-Mead',options={'xatol':1e-3,'fatol':1e-7})
w,y,b,mu,n=curve(best.x)
print('pesos R,G,B =',np.round(w,3),' RMS =',round(float(np.sqrt(best.fun))*255,2),'níveis (0-255)')
print('Rec709 RMS =',round(float(np.sqrt(loss(np.array([.2126,.7152,.0722]))))*255,2))
np.savez(S+'/curve_v1.npz',w=w,edges=edges,mu=mu,n=n)
for e,m_,c in zip(edges[::6],mu[::6],n[::6]): print(f'log2Y={e:6.2f}  v1={m_*255 if c else float("nan"):6.1f}  n={c}')
