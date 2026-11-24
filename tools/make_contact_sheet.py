# 60명 초상화 연락 시트 생성: python tools/make_contact_sheet.py  (필요: pip install pillow)
# 파일이 있는 장수는 이미지를, 없는 장수는 "미제작" 칸을 표시합니다. 결과: docs/portrait-reference/contact_sheet_60_status.jpg
import re, os
from PIL import Image, ImageDraw, ImageFont
HERE=os.path.dirname(os.path.abspath(__file__)); B=os.path.join(HERE,"..","browser-test")
src=open(os.path.join(B,"js","generals.js"),encoding="utf-8").read()
gens=re.findall(r'"id": "(gen_\d+)",\s*"name": "([^"]+)",\s*"faction": "([^"]+)",\s*"rank": "([^"]+)"',src)
FONTS=["/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc","/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc","C:/Windows/Fonts/malgun.ttf","/System/Library/Fonts/AppleSDGothicNeo.ttc"]
fp=next((f for f in FONTS if os.path.exists(f)),None)
f1=ImageFont.truetype(fp,15) if fp else ImageFont.load_default(); f2=ImageFont.truetype(fp,17) if fp else ImageFont.load_default()
TW,TH,LH,PAD,COLS=160,200,44,10,10
rows=(len(gens)+COLS-1)//COLS; W=COLS*(TW+PAD)+PAD; H=rows*(TH+LH+PAD)+PAD+46
sheet=Image.new("RGB",(W,H),(16,24,39)); d=ImageDraw.Draw(sheet)
have=0
d.text((PAD,12),"삼국지: 천하패권 — 장수 초상화 60명 현황 (이미지 있음 / 미제작)",fill=(240,214,140),font=f2)
for i,(gid,name,fac,rank) in enumerate(gens):
    x=PAD+(i%COLS)*(TW+PAD); y=46+PAD+(i//COLS)*(TH+LH+PAD); p=os.path.join(B,"assets","portraits",gid+".webp")
    if os.path.exists(p):
        have+=1; im=Image.open(p).convert("RGB").resize((TW,TH),Image.LANCZOS); sheet.paste(im,(x,y)); col=(220,225,235)
    else:
        d.rectangle([x,y,x+TW-1,y+TH-1],fill=(32,44,64),outline=(190,70,70),width=2); d.text((x+TW//2,y+TH//2),"미제작",fill=(230,120,120),font=f2,anchor="mm"); col=(230,140,140)
    d.text((x,y+TH+4),gid,fill=col,font=f1); d.text((x,y+TH+22),f"{name} · {fac} · {rank}",fill=col,font=f1)
out=os.path.join(HERE,"..","docs","portrait-reference","contact_sheet_60_status.jpg"); sheet.save(out,quality=88)
print(f"저장: {out}  (이미지 {have}/{len(gens)}명)")
