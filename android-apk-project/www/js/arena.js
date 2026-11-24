// v2.1.0 아레나 전술 엔진: 수동 필살기·아군 지정 회복·강화된 전투 밸런스
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function arenaStats(g,equipmentInventory=[]){
 const s=g.stats||{},level=Math.max(1,Number(g.level)||1),awaken=Math.max(0,Number(g.awakening)||0);
 const rank={일반:1,고급:1.06,희귀:1.12,영웅:1.19,전설:1.27}[g.rank]||1;
 const martial=Number(s.martial)||50,intel=Number(s.intelligence)||50,lead=Number(s.leadership)||50;
 const eq=(equipmentInventory||[]).filter(x=>Object.values(g.equipment||{}).includes(x.uid)).reduce((a,x)=>a+(Number(x.value)||0)+(Number(x.enhance)||0)*2,0);
 // 체력은 낮추고 공격·방어의 실전 영향력을 높여 교전 템포를 빠르게 조정
 const hp=Math.round((610+lead*7+martial*1.2+level*20+awaken*35)*rank);
 const atk=Math.round((88+martial*1.35+intel*.22+level*4.1+eq*.48)*rank);
 const def=Math.round((22+lead*.24+martial*.12+level*.8+eq*.12)*rank);
 const spd=Math.round(75+intel*.22+lead*.08+(g.style==="공격형"?5:g.style==="전술형"?3:0));
 const passive=g.combatEffects?.passive||{},bonus=Math.round((Number(s[passive.stat])||0)*(Number(passive.rate)||0));
 const skill=skillProfile(g);
 return {hp,maxHp:hp,atk:atk+(passive.stat==="martial"?bonus:0),def:def+(passive.stat==="leadership"?Math.round(bonus*.15):0),spd:spd+(passive.stat==="intelligence"?Math.round(bonus*.15):0),crit:clamp(8+martial*.16,8,28),rank:g.rank,skill};
}
const FORMS=[
 {type:"stun",turns:1,kind:"attack",chance:22,desc:"기절 1턴"},
 {type:"slow",turns:2,kind:"attack",chance:72,desc:"속도 감소 · 2턴"},
 {type:"dot",turns:3,kind:"attack",chance:68,desc:"지속 피해 · 3턴"},
 {type:"atkUp",turns:2,kind:"self",desc:"자신의 공격력 증가 · 2턴"},
 {type:"shield",turns:2,kind:"self",desc:"자신에게 보호막 · 2턴"},
 {type:"defDown",turns:2,kind:"attack",chance:62,desc:"방어력 감소 · 2턴"},
 {type:"heal",turns:0,kind:"ally",desc:"아군 1명 체력 회복"}
];
const RANK_POWER={일반:0,고급:2,희귀:4,영웅:6,전설:9};
function skillProfile(g){
 const n=parseInt(String(g.id).replace(/\D/g,""),10)||1,f=FORMS[(n-1)%FORMS.length],r=RANK_POWER[g.rank]||0;
 const chance=f.chance==null?100:Math.min(85,f.chance+Math.round(r*.65));
 const percent=f.type==="atkUp"?14+r:f.type==="shield"?28+r*1.2:f.type==="defDown"?16+r:f.type==="slow"?28+r*.5:0;
 const healPercent=f.type==="heal"?28+r*1.2:0;
 const desc=f.type==="atkUp"?"공격력 "+Math.round(percent)+"% 증가 · 2턴":f.type==="shield"?"최대 체력의 "+Math.round(percent)+"% 보호막 · 2턴":f.type==="defDown"?"방어력 "+Math.round(percent)+"% 감소 · 2턴":f.type==="slow"?"속도 "+Math.round(percent)+"% 감소 · 2턴":f.type==="heal"?"아군 체력 "+Math.round(healPercent)+"% 회복":f.type==="dot"?"공격력의 18% 지속 피해 · 3턴":f.desc;
 return {...f,power:Math.round(percent),healPercent:Math.round(healPercent),chance,name:g.skillName||"고유 필살기",description:desc,cooldown:3};
}
export function createArenaTeam(generals,ids,inventory=[],enemy=false){
 return ids.map(id=>{const g=generals.find(x=>x.id===id);if(!g)return null;const stats=arenaStats(g,inventory);if(enemy){stats.hp=Math.round(stats.hp*1.04);stats.maxHp=stats.hp;stats.atk=Math.round(stats.atk*1.02)}return {id:g.id,name:g.name,style:g.style,faction:g.faction,rank:g.rank,level:g.level||1,hp:stats.hp,stats,effects:[],skill:stats.skill,skillCooldown:0,team:enemy?"enemy":"player"}}).filter(Boolean)
}
export function alive(team){return team.filter(u=>u.hp>0)}
export function arenaOrder(player,enemy){return [...alive(player),...alive(enemy)].sort((a,b)=>{const sa=a.effects.find(e=>e.type==="slow"&&e.turns>0)?.power||0,sb=b.effects.find(e=>e.type==="slow"&&e.turns>0)?.power||0;return (b.stats.spd*(1-sb/100))-(a.stats.spd*(1-sa/100))})}
const active=(u,t)=>u.effects.find(e=>e.type===t&&e.turns>0);
function age(u){for(const e of u.effects)if(e.turns>0)e.turns--;if(u.skillCooldown>0)u.skillCooldown--;u.effects=u.effects.filter(e=>e.turns>0&&(!["shield"].includes(e.type)||e.power>0))}
function pushEffect(unit,effect){unit.effects=unit.effects.filter(e=>e.type!==effect.type);unit.effects.push({...effect})}
export function applyArenaAttack(actor,target,log,useSkill=false){
 if(!actor||!target||actor.hp<=0||target.hp<=0||actor.team===target.team)return {ok:false};
 const push=s=>log.push(s);
 for(const e of actor.effects)if(e.type==="dot"&&e.turns>0){actor.hp=Math.max(0,actor.hp-e.power);push("☠ "+actor.name+" 지속 피해 "+e.power)}
 if(actor.hp<=0)return {ok:true,skipped:true};
 if(active(actor,"stun")){push("✦ "+actor.name+" 기절 · 행동 불가");age(actor);return {ok:true,skipped:true}}
 if(useSkill&&(actor.skillCooldown>0))return {ok:false,reason:"필살기는 아직 재사용 대기 중입니다."};
 const skill=useSkill?actor.skill:null;
 const attackRate=1+(active(actor,"atkUp")?.power||0)/100;
 const defenseRate=1-(active(target,"defDown")?.power||0)/100;
 let damage=Math.max(18,Math.round(actor.stats.atk*(useSkill?1.55:1.0)*attackRate*(0.9+Math.random()*.28)-target.stats.def*defenseRate*.78));
 if(Math.random()*100<actor.stats.crit){damage=Math.round(damage*1.65);push("⚡ "+actor.name+" 치명타!")}
 const shield=active(target,"shield");if(shield){const absorbed=Math.min(shield.power,damage);shield.power-=absorbed;damage-=absorbed;if(!shield.power)shield.turns=0;push("🛡 "+target.name+" 보호막이 "+absorbed+" 흡수")}
 target.hp=Math.max(0,target.hp-damage);push((useSkill?"★ 필살기 ":"")+actor.name+" → "+target.name+" "+damage+" 피해"+(target.hp===0?" · 전투불능":""));
 if(useSkill&&skill){
  actor.skillCooldown=skill.cooldown;
  if(skill.kind==="self"){
   const amount=skill.type==="shield"?Math.round(actor.stats.maxHp*skill.power/100):skill.power;
   pushEffect(actor,{type:skill.type,turns:skill.turns,power:amount});push("✦ "+actor.name+" "+skill.name+" · "+(skill.type==="shield"?"보호막 "+amount:"공격력 "+amount+"% 증가"));
  }else if(skill.kind==="attack"&&target.hp>0){
   const success=Math.random()*100<skill.chance;
   if(success){const e={type:skill.type,turns:skill.turns,power:skill.type==="dot"?Math.round(actor.stats.atk*.18):skill.power};pushEffect(target,e);push("☄ "+target.name+" 상태 효과 적용 성공 · "+skill.description)}else push("☄ "+target.name+" 상태 효과 저항 · 적용 확률 "+skill.chance+"%");
  }
 }
 age(actor);return {ok:true,damage};
}
export function applyArenaHeal(actor,target,log){
 if(!actor||!target||actor.hp<=0||target.hp<=0||actor.team!==target.team)return {ok:false};
 if(actor.skillCooldown>0)return {ok:false,reason:"필살기는 아직 재사용 대기 중입니다."};
 for(const e of actor.effects)if(e.type==="dot"&&e.turns>0){actor.hp=Math.max(0,actor.hp-e.power);log.push("☠ "+actor.name+" 지속 피해 "+e.power)}
 if(actor.hp<=0)return {ok:false,reason:"지속 피해로 행동할 수 없습니다."};
 if(active(actor,"stun")){log.push("⚡ "+actor.name+" 기절 · 회복 행동 불가");age(actor);return {ok:false,reason:"기절 상태에서는 회복할 수 없습니다."}}
 const amount=Math.min(target.stats.maxHp-target.hp,Math.round(target.stats.maxHp*actor.skill.healPercent/100));
 target.hp=Math.min(target.stats.maxHp,target.hp+amount);actor.skillCooldown=actor.skill.cooldown;age(actor);
 log.push("✚ "+actor.name+"의 "+actor.skill.name+" · "+target.name+" 체력 "+amount+" 회복");
 return {ok:true,healed:amount};
}
export function takeArenaTurn(actor,target,log){return applyArenaAttack(actor,target,log,false)}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function factionClass(f){return ({위:"wei",촉:"shu",오:"wu",군웅:"other"})[f]||"other"}
export function renderArenaTeam(generals,team,options={}){
 return team.map(u=>{const g=generals.find(x=>x.id===u.id);if(!g)return "";const pct=Math.max(0,u.hp/u.stats.maxHp*100),effects=u.effects.filter(e=>e.turns>0),status=effects.map(e=>({stun:"기절",slow:"속도↓",atkUp:"공격↑",shield:"보호막",dot:"지속 피해",defDown:"방어↓"}[e.type])).join(" · ")||"정상";
 const effectClass=effects.map(e=>e.type).join(" "),selectable=options.selectable&&u.hp>0,healable=options.healable&&u.hp>0&&u.hp<u.stats.maxHp&&u.id!==options.excludeId,turnActions=options.turnActions&&u.id===options.activeId;
 const overlay=effects.map(e=>({stun:"⚡",slow:"〰",dot:"☠",atkUp:"🔥",shield:"🛡",defDown:"🛡"}[e.type])).filter(Boolean).join(" ");
 return '<article class="arena-unit faction-'+factionClass(g.faction)+' '+(u.hp<=0?"fallen":"")+' '+(options.activeId===u.id?"acting":"")+' '+effectClass+'"><div class="arena-status-art" aria-hidden="true">'+overlay+'</div><div class="arena-card-top"><span>'+safe(g.faction)+'</span><span>'+safe(g.rank)+'</span></div><h4>'+safe(g.name)+'</h4><div class="arena-card-role">'+safe(g.style)+' · 속도 '+u.stats.spd+'</div><div class="arena-hp"><i style="width:'+pct+'%"></i></div><div class="arena-hp-label">체력 '+Math.max(0,u.hp).toLocaleString()+' / '+u.stats.maxHp.toLocaleString()+'</div><div class="arena-stats"><span>공 '+u.stats.atk+'</span><span>방 '+u.stats.def+'</span><span>속 '+u.stats.spd+'</span></div><div class="arena-card-skill"><b>'+safe(u.skill.name)+'</b><small>'+safe(u.skill.description)+'</small></div>' +(turnActions?'<div class="arena-card-actions"><button type="button" class="arena-card-action normal" data-arena-card-action="attack">일반 공격</button><button type="button" class="arena-card-action ultimate" data-arena-card-action="skill" '+(u.skillCooldown>0?'disabled':'')+'><span>필살기</span><small>'+(u.skillCooldown>0?'대기 '+u.skillCooldown+'턴':(u.skill.chance===100?'사용 가능':'효과 '+u.skill.chance+'%'))+'</small></button></div>':'')+'<div class="arena-card-status">'+safe(status)+'</div>'+(selectable?'<button type="button" class="arena-target-btn" data-arena-target="'+safe(u.id)+'">공격 대상</button>':"")+(healable?'<button type="button" class="arena-heal-target-btn" data-arena-heal-target="'+safe(u.id)+'">이 장수 회복</button>':"")+'</article>';
 }).join("");
}
