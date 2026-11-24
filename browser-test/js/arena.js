
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function arenaStats(g, equipmentInventory=[]) {
  const s=g.stats||{}, level=Math.max(1,Number(g.level)||1), awaken=Math.max(0,Number(g.awakening)||0);
  const rank={일반:1,고급:1.06,희귀:1.12,영웅:1.19,전설:1.27}[g.rank]||1;
  const martial=Number(s.martial)||50, intel=Number(s.intelligence)||50, lead=Number(s.leadership)||50;
  const eq=(equipmentInventory||[]).filter(x=>Object.values(g.equipment||{}).includes(x.uid)).reduce((a,x)=>a+(Number(x.value)||0)+(Number(x.enhance)||0)*2,0);
  const hp=Math.round((900+lead*12+martial*2+level*34+awaken*55)*rank);
  const atk=Math.round((48+martial*.82+intel*.12+level*2.8+eq*.25)*rank);
  const def=Math.round((30+lead*.42+martial*.18+level*1.9+eq*.2)*rank);
  const spd=Math.round(75+intel*.22+lead*.08+(g.style==="공격형"?5:g.style==="전술형"?3:0));
  const profile=skillProfile(g);
  const passive=g.combatEffects?.passive||{};
  const passiveRate=Number(passive.rate)||0;
  const passiveBonus=Math.round((Number(s[passive.stat])||0)*passiveRate);
  if(passive.stat==="martial")return {hp,maxHp:hp,atk:atk+passiveBonus,def,spd,crit:clamp(5+martial*.12,5,22),rank:g.rank,passiveBonus,skill:profile};
  if(passive.stat==="intelligence")return {hp,maxHp:hp,atk,def,spd:spd+Math.round(passiveBonus*.15),crit:clamp(5+martial*.12,5,22),rank:g.rank,passiveBonus,skill:profile};
  return {hp,maxHp:hp,atk,def: def+Math.round(passiveBonus*.15),spd,crit:clamp(5+martial*.12,5,22),rank:g.rank,passiveBonus,skill:profile};
}
const SKILL_FORMS=[
 {type:"stun",turns:1,power:0,label:"기절"},
 {type:"slow",turns:2,power:18,label:"속도 감소"},
 {type:"dot",turns:2,power:0,label:"지속 피해"},
 {type:"atkUp",turns:2,power:20,label:"공격력 증가"},
 {type:"shield",turns:2,power:0,label:"보호막"},
 {type:"weaken",turns:2,power:15,label:"공격력 약화"}
];
function skillProfile(g){const n=parseInt(String(g.id).replace(/\D/g,""),10)||1;const form=SKILL_FORMS[(n-1)%SKILL_FORMS.length];return {...form,name:g.skillName||"고유 전술",description:g.skillDesc||"전투 중 고유 효과 발동",cooldown:2+(n%2)};}
function skillFor(unit,target,team,enemy,log){
  if(unit.skillCooldown>0||Math.random()>=.34)return;
  const skill=unit.skill;unit.skillCooldown=skill.cooldown;
  const e={type:skill.type,turns:skill.turns,power:skill.power};
  if(skill.type==="stun"){target.effects.push(e);log.push(`${unit.name} [${skill.name}] · ${target.name} 기절`);}
  else if(skill.type==="slow"){target.effects.push(e);log.push(`${unit.name} [${skill.name}] · ${target.name} 속도 ${skill.power}% 감소`);}
  else if(skill.type==="dot"){e.power=Math.max(10,Math.round(unit.stats.atk*.16));target.effects.push(e);log.push(`${unit.name} [${skill.name}] · 지속 피해 ${e.power}`);}
  else if(skill.type==="atkUp"){unit.effects.push(e);log.push(`${unit.name} [${skill.name}] · 공격력 증가`);}
  else if(skill.type==="shield"){e.power=Math.round(unit.stats.maxHp*.18);unit.effects.push(e);log.push(`${unit.name} [${skill.name}] · 보호막 ${e.power}`);}
  else {target.effects.push(e);log.push(`${unit.name} [${skill.name}] · ${target.name} 공격력 약화`);}
}
function effect(unit,type){return unit.effects.find(e=>e.type===type&&e.turns>0)}
function alive(team){return team.filter(u=>u.hp>0)}
function hit(attacker,target,log){
  if(effect(attacker,"stun")){log.push(`${attacker.name}은(는) 기절하여 행동하지 못함`);return;}
  const atk=attacker.stats.atk+(effect(attacker,"atkUp")?.power||0);
  const def=target.stats.def+(effect(target,"weaken")?.power||0);
  let damage=Math.max(12,Math.round(atk*(.82+Math.random()*.34)-def*.48));
  if(Math.random()*100<attacker.stats.crit){damage=Math.round(damage*1.55);log.push(`${attacker.name} 치명타!`)}
  const shield=effect(target,"shield");if(shield){const absorbed=Math.min(shield.power,damage);shield.power-=absorbed;damage-=absorbed;if(!shield.power)shield.turns=0;}
  target.hp=Math.max(0,target.hp-damage);log.push(`${attacker.name} → ${target.name} ${damage} 피해${target.hp===0?" · 전투불능":""}`);
  if(target.hp>0)skillFor(attacker,target,attacker.team, target.team,log);
}
function tick(unit,log){
  for(const e of unit.effects){if(e.turns>0&&e.type==="dot"){unit.hp=Math.max(0,unit.hp-e.power);log.push(`${unit.name} 지속 피해 ${e.power}`)}}
}
function ageEffects(unit){for(const e of unit.effects)if(e.turns>0)e.turns--;if(unit.skillCooldown>0)unit.skillCooldown--;unit.effects=unit.effects.filter(e=>e.turns>0&&(!["shield"].includes(e.type)||e.power>0));}
function escCard(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]))}
function factionClass(f){return ({위:"wei",촉:"shu",오:"wu",군웅:"other"})[f]||"other"}
function card(g,unit){
 const pct=Math.max(0,unit.hp/unit.stats.maxHp*100),effects=unit.effects.filter(e=>e.turns>0).map(e=>({stun:"기절",slow:"속도↓",atkUp:"공격↑",shield:"보호막",dot:"지속 피해",weaken:"공격↓"}[e.type])).filter(Boolean);
 const status=effects.length?effects.join(" · "):"상태 양호";
 const name=escCard(g.name),skill=escCard(unit.skill?.name||g.skillName||"고유 전술"),effect=escCard(({stun:"적 행동 봉쇄",slow:"적 속도 감소",dot:"지속 피해",atkUp:"자신 공격 강화",shield:"보호막 생성",weaken:"적 공격 약화"})[unit.skill?.type]||"전투 효과 발동");
 const backSkill=escCard(g.skillDesc||unit.skill?.description||"고유 기술 효과"),passive=escCard(g.passiveName||"고유 특성"),passiveDesc=escCard(g.passive||g.passiveDesc||"전투 중 능력 보정"),weak=escCard(g.weaknessName||"전투 약점"),weakDesc=escCard(g.weakness||g.weaknessDesc||"상성에 따라 전투력이 달라집니다.");
 return `<article class="arena-unit ${unit.hp<=0?"fallen":""} faction-${factionClass(g.faction)}"><section class="arena-card-face arena-card-front"><div class="arena-card-top"><span>${escCard(g.faction||"군웅")}</span><span>${escCard(g.rank||"장수")}</span></div><h4>${name}</h4><div class="arena-card-role">${escCard(g.style||"전술형")} · ${escCard(effect)}</div><div class="arena-hp"><i style="width:${pct}%"></i></div><div class="arena-hp-label">체력 ${Math.max(0,unit.hp).toLocaleString()} / ${unit.stats.maxHp.toLocaleString()}</div><div class="arena-stats"><span>공 ${unit.stats.atk}</span><span>방 ${unit.stats.def}</span><span>속 ${unit.stats.spd}</span></div><div class="arena-card-skill"><b>${skill}</b><small>${effect}</small></div><div class="arena-card-status">${escCard(status)}</div><button type="button" class="arena-flip" aria-label="${name} 뒷면 보기" data-arena-flip>뒷면 보기 ↗</button></section><section class="arena-card-face arena-card-back"><div class="arena-card-top"><span>${escCard(g.faction||"군웅")}</span><span>장수 정보</span></div><h4>${name}</h4><div class="arena-back-section"><b>고유 기술 · ${skill}</b><p>${backSkill}</p></div><div class="arena-back-section"><b>지속 특성 · ${passive}</b><p>${passiveDesc}</p></div><div class="arena-back-section"><b>${weak}</b><p>${weakDesc}</p></div><button type="button" class="arena-flip" aria-label="${name} 앞면 보기" data-arena-flip>앞면 보기 ↩</button></section></article>`;
}
export function createArenaTeam(generals,ids,inventory=[],enemy=false){return ids.map(id=>{const g=generals.find(x=>x.id===id);if(!g)return null;const stats=arenaStats(g,inventory);if(enemy){stats.hp=Math.round(stats.hp*1.04);stats.maxHp=stats.hp;stats.atk=Math.round(stats.atk*1.02)}return {id:g.id,name:g.name,style:g.style,rank:g.rank,level:g.level||1,hp:stats.hp,stats,effects:[],skill:stats.skill,skillCooldown:0,team:enemy?"enemy":"player"}}).filter(Boolean)}
export function simulateArena(generals,playerIds,enemyIds,inventory=[]){
 const player=createArenaTeam(generals,playerIds,inventory,false),enemy=createArenaTeam(generals,enemyIds,inventory,true),log=[];
 const all=[...player,...enemy];let turn=0;
 while(alive(player).length&&alive(enemy).length&&turn<40){turn++;const order=all.filter(u=>u.hp>0).sort((a,b)=>{const as=a.stats.spd-(effect(a,"slow")?.power||0),bs=b.stats.spd-(effect(b,"slow")?.power||0);return bs-as});
  for(const actor of order){if(actor.hp<=0||!alive(actor.team==="player"?player:enemy).length)continue;const foes=alive(actor.team==="player"?enemy:player);if(!foes.length)break;tick(actor,log);if(actor.hp<=0)continue;const target=foes.sort((a,b)=>a.hp/a.stats.maxHp-b.hp/b.stats.maxHp)[0];hit(actor,target,log);ageEffects(actor);}
 }
 const win=alive(player).length>alive(enemy).length;return {win,player,enemy,turns:turn,log,playerIds,enemyIds};
}
export function renderArenaTeam(generals,team){return team.map(u=>{const g=generals.find(x=>x.id===u.id);return g?card(g,u):""}).join("")}
