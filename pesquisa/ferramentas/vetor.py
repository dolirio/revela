# Extrai curvas vetoriais de gráficos de fichas técnicas (PDF) e converte para unidades dos eixos.
import pdfplumber, math, json, sys
def bez(p0,p1,p2,p3,n=12):
    return [tuple((1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t**2*c+t**3*d for a,b,c,d in zip(p0,p1,p2,p3)) for t in [i/n for i in range(1,n+1)]]
def polyline(o):
    pts=[]; cur=None
    for seg in o['path']:
        op=seg[0]
        if op in('m','l'): cur=seg[1]; pts.append(cur)
        elif op=='c': c1,c2,e=seg[1],seg[2],seg[3]; pts+=bez(cur,c1,c2,e); cur=e
    return pts
def curves_in(page, box, minpts=5):
    x0,t0,x1,b0=box
    out=[]
    for o in page.curves:
        if o['x0']>=x0-1 and o['x1']<=x1+1 and o['top']>=t0-1 and o['bottom']<=b0+1 and len(o['path'])>=minpts and not o.get('fill'):
            out.append(polyline(o))
    return out
def axis(p_a,v_a,p_b,v_b,log=False):
    if log: v_a,v_b=math.log10(v_a),math.log10(v_b)
    k=(v_b-v_a)/(p_b-p_a)
    return (lambda p: 10**(v_a+(p-p_a)*k)) if log else (lambda p: v_a+(p-p_a)*k)

import re
def fit(pairs, log=False):
    # mínimos quadrados: posição (pt) -> valor do eixo
    ps=[a for a,_ in pairs]; vs=[math.log10(b) if log else b for _,b in pairs]
    n=len(ps); mp=sum(ps)/n; mv=sum(vs)/n
    k=sum((p-mp)*(v-mv) for p,v in zip(ps,vs))/sum((p-mp)**2 for p in ps); b=mv-k*mp
    res=max(abs(k*p+b-v) for p,v in zip(ps,vs))
    return ((lambda p:10**(k*p+b)) if log else (lambda p:k*p+b)), res
def chart(page, box, xlog=False, ylog=False, minpts=8, skip_frame=True):
    """Lê os rótulos numéricos dos eixos e devolve as curvas do quadro em unidades dos eixos."""
    x0,t0,x1,b0=box
    ws=[w for w in page.extract_words() if re.fullmatch(r'-?\d+(\.\d+)?', w['text'])]
    cx=lambda w:(w['x0']+w['x1'])/2; cy=lambda w:(w['top']+w['bottom'])/2
    xl=[(cx(w),float(w['text'])) for w in ws if x0-12<=cx(w)<=x1+12 and b0<cy(w)<=b0+16]
    yl=[(cy(w),float(w['text'])) for w in ws if x0-30<=cx(w)<x0 and t0-8<=cy(w)<=b0+8]
    fx,ex=fit(xl,xlog); fy,ey=fit(yl,ylog)
    out=[]
    for c in curves_in(page,box,minpts):
        xs=[x for x,_ in c]; ys=[y for _,y in c]
        if skip_frame and (max(xs)-min(xs))>0.97*(x1-x0) and (max(ys)-min(ys))>0.97*(b0-t0) and len(c)<=10: continue
        out.append([(fx(x),fy(y)) for x,y in c])
    return out, {'x_labels':xl,'y_labels':yl,'x_fit_err':ex,'y_fit_err':ey}
