"""Produce the downloadable library and portable per-pack archives."""
from pathlib import Path
import json,zipfile,html
root=Path(__file__).resolve().parents[1]/'public'/'kingdom'/'kaykit'
m=json.loads((root/'manifest.json').read_text())
cards=[]
for pack in m['packs']:
    with zipfile.ZipFile(root/(pack['id']+'.zip'),'w',zipfile.ZIP_DEFLATED) as z:
        for item in pack['files']:z.write(root/item['path'],item['path'])
    for item in pack['files']:
        p=Path(item['path'])
        if p.suffix not in ['.glb','.gltf']:continue
        cards.append('<article data-name="'+html.escape(p.stem.lower())+'"><strong>'+html.escape(p.stem)+'</strong><p>'+pack['id']+'</p><a download href="'+html.escape(item['path'])+'">'+p.suffix+' ↓</a></article>')
page='''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مكتبة مجسمات ممالك حينا</title><style>body{background:#102e32;color:#fff4dc;font:16px Tahoma;margin:0;padding:30px}h1{color:#e5c47f}a{color:#f4d284}nav{display:flex;gap:24px;flex-wrap:wrap;padding:20px;background:#244b46;border-radius:16px}input{padding:14px;margin:20px 0;width:min(90%,500px);border-radius:12px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}article{padding:18px;border:1px solid #60877b;border-radius:14px;overflow-wrap:anywhere}p{line-height:1.9}small{color:#b5d0c4}</style><h1>مكتبة مجسمات ممالك حينا</h1><p>شخصيات متحركة، مبانٍ، قلاع، أشجار، تضاريس، أنهار وطرق — KayKit / Kay Lousberg — CC0.</p><nav><a href="/kingdom">العودة للعبة</a><a download href="adventurers.zip">تنزيل الشخصيات والأسلحة كاملة ZIP</a><a download href="medieval.zip">تنزيل المباني وقطع الخريطة كاملة ZIP</a><a href="../KAYKIT.md">دليل الدمج والمصادر</a></nav><p>المجسم GLB للشخصية مستقل. مجسمات glTF تحتاج ملفات BIN والصور معها؛ استخدم ZIP للحفاظ على جميع التبعيات. تتضمن الخريطة قطعًا قابلة للتجميع وليست عالمًا خارجيًا جاهزًا.</p><input id="search" aria-label="البحث عن مجسم" placeholder="ابحث: castle / home / tree / Knight / river"><small>253 مجسمًا وملف شخصية</small><main>'''+''.join(cards)+'''</main><script>document.getElementById('search').oninput=e=>{let q=e.target.value.toLowerCase();document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.name.includes(q))}</script></html>'''
(root/'catalog.html').write_text(page,encoding='utf-8')
print('Created asset catalog and 2 complete downloadable ZIP packs')
