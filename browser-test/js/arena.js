// 아레나 전용 턴제 전투 엔진: 결과를 선계산하지 않고 행동 1회씩 처리합니다.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function arenaStats(g, equipmentInventory=[]) {
 const s=g.stats||{},level=Math.max(1,Number(g.level)||1),awaken=Math.max(0,Number(g.awakening)||0);
 const rank={일반:1,고급:1.06,희귀:1.12,영웅:1.19,전설:1.27}[g.rank]||1;
 const martial=Number(s.martial)||50,intel=Number(s.intelligence)||50,lead=Number(s.leadership)||50;
 const eq=(equipmentInventory||[]).filter(x=>Object.values(g.equipment||{}).includes(x.uid)).reduce((a,x)=>a+(Number(x.value)||0)+(Number(x.enhance)||0)*2,0);
 const hp=Math.round((900+lead*12+martial*2+level*34+awaken*55)*rank);
 const atk=Math.round((48+martial*.82+intel*.12+level*2.8+eq*.25)*rank);
 const def=Math.round((30+lead*.42+martial*.18+level*1.9+eq*.2)*rank);
 const spd=Math.round(75+intel*.22+lead*.08+(g.style==="공격형"?5:g.style==="전술형"?3:0));
 const passive=g.combatEffects?.passive||{},bonus=Math.round((Number(s[passive.stat])||0)*(Number(passive.rate)||0));
 const skill=skillProfile(g);
 return {hp,maxHp:hp,atk:atk+(passive.stat==="martial"?bonus:0),def:def+(passive.stat==="leadership"?Math.round(bonus*.15):0),spd:spd+(passive.stat==="intelligence"?Math.round(bonus*.15):0),crit:clamp(5+martial*.12,5,22),rank:g.rank,skill};
}
const FORMS=[{type:"stun",turns:1,power:0},{type:"slow",turns:2,power:18},{type:"dot",turns:2,power:0},{type:"atkUp",turns:2,power:20},{type:"shield",turns:2,power:0},{type:"weaken",turns:2,power:15}];
function skillProfile(g){const n=parseInt(String(g.id).replace(/\D/g,""),10)||1;return {...FORMS[(n-1)%FORMS.length],name:g.skillName||"고유 전술",description:g.skillDesc||"전투 중 고유 효과 발동",cooldown:2+(n%2)}}
export function createArenaTeam(generals,ids,inventory=[],enemy=false){
 return ids.map(id=>{const g=generals.find(x=>x.id===id);if(!g)return null;const stats=arenaStats(g,inventory);if(enemy){stats.hp=Math.round(stats.hp*1.04);stats.maxHp=stats.hp;stats.atk=Math.round(stats.atk*1.02)}return {id:g.id,name:g.name,style:g.style,faction:g.faction,rank:g.rank,level:g.level||1,hp:stats.hp,stats,effects:[],skill:stats.skill,skillCooldown:0,team:enemy?"enemy":"player",acted:false}}).filter(Boolean)
}
export function alive(team){return team.filter(u=>u.hp>0)}
export function arenaOrder(player,enemy){
 return [...alive(player),...alive(enemy)].sort((a,b)=>{
  const slowA=a.effects.find(e=>e.type==="slow"&&e.turns>0)?.power||0,slowB=b.effects.find(e=>e.type==="slow"&&e.turns>0)?.power||0;
  return (b.stats.spd-slowB)-(a.stats.spd-slowA);
 });
}
const active=(u,t)=>u.effects.find(e=>e.type===t&&e.turns>0);
export function takeArenaTurn(actor,target,log){
 if(!actor||!target||actor.hp<=0||target.hp<=0)return {ok:false};
 const push=s=>log.push(s);
 for(const e of actor.effects)if(e.type==="dot"&&e.turns>0){actor.hp=Math.max(0,actor.hp-e.power);push(actor.name+" 지속 피해 "+e.power)}
 if(actor.hp<=0)return {ok:true,skipped:true,reason:"지속 피해로 전투불능"};
 if(active(actor,"stun")){push(actor.name+" 기절 · 행동 불가");age(actor);return {ok:true,skipped:true}}
 let damage=Math.max(12,Math.round((actor.stats.atk+(active(actor,"atkUp")?.power||0))*(.82+Math.random()*.34)-(target.stats.def+(active(target,"weaken")?.power||0))*.48));
 if(Math.random()*100<actor.stats.crit){damage=Math.round(damage*1.55);push(actor.name+" 치명타!")}
 const shield=active(target,"shield");if(shield){const absorbed=Math.min(shield.power,damage);shield.power-=absorbed;damage-=absorbed;if(!shield.power)shield.turns=0;push(target.name+" 보호막이 피해 "+absorbed+" 흡수")}
 target.hp=Math.max(0,target.hp-damage);push(actor.name+" → "+target.name+" "+damage+" 피해"+(target.hp===0?" · 전투불능":""));
 if(target.hp>0&&actor.skillCooldown<=0&&Math.random()<.34){
  const sk=actor.skill,e={type:sk.type,turns:sk.turns,power:sk.power};actor.skillCooldown=sk.cooldown;
  if(sk.type==="dot")e.power=Math.max(10,Math.round(actor.stats.atk*.16));
  if(sk.type==="shield")e.power=Math.round(actor.stats.maxHp*.18);
  (["atkUp","shield"].includes(sk.type)?actor.effects:target.effects).push(e);
  push(actor.name+" 발동 · "+sk.name+(sk.type==="stun"?" · "+target.name+" 기절":""));
 }
 age(actor);return {ok:true,damage};
}
function age(u){for(const e of u.effects)if(e.turns>0)e.turns--;if(u.skillCooldown>0)u.skillCooldown--;u.effects=u.effects.filter(e=>e.turns>0&&(!["shield"].includes(e.type)||e.power>0))}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function factionClass(f){return ({위:"wei",촉:"shu",오:"wu",군웅:"other"})[f]||"other"}
export function renderArenaTeam(generals,team,options={}){
 return team.map(u=>{const g=generals.find(x=>x.id===u.id);if(!g)return "";const pct=Math.max(0,u.hp/u.stats.maxHp*100),status=u.effects.filter(e=>e.turns>0).map(e=>({stun:"기절",slow:"속도↓",atkUp:"공격↑",shield:"보호막",dot:"지속 피해",weaken:"공격↓"}[e.type])).join(" · ")||"정상";
 const selectable=options.selectable&&u.hp>0;
 return '<article class="arena-unit faction-'+factionClass(g.faction)+' '+(u.hp<=0?"fallen":"")+' '+(options.activeId===u.id?"acting":"")+'"><div class="arena-card-top"><span>'+safe(g.faction)+'</span><span>'+safe(g.rank)+'</span></div><h4>'+safe(g.name)+'</h4><div class="arena-card-role">'+safe(g.style)+' · 속도 '+u.stats.spd+'</div><div class="arena-hp"><i style="width:'+pct+'%"></i></div><div class="arena-hp-label">체력 '+Math.max(0,u.hp).toLocaleString()+' / '+u.stats.maxHp.toLocaleString()+'</div><div class="arena-stats"><span>공 '+u.stats.atk+'</span><span>방 '+u.stats.def+'</span><span>속 '+u.stats.spd+'</span></div><div class="arena-card-skill"><b>'+safe(u.skill.name)+'</b><small>'+safe(u.skill.description)+'</small></div><div class="arena-card-status">'+safe(status)+'</div>'+(selectable?'<button type="button" class="arena-target-btn" data-arena-target="'+safe(u.id)+'">이 장수 공격</button>':"")+'</article>';
 }).join("");
}
