import { GENERAL_DATA } from "./generals.js";
import { loadState, saveState, replaceState, saveRecovery, migrateState, SAVE_FORMAT_VERSION } from "./db.js";
import { APP_VERSION, BACKUP_VERSION } from "./version.js";
import { ensureRecruitState } from "./recruit.js";
import { createRecruitUI } from "./recruit-ui.js";
import { addExperience, awakenGeneral, normalizeGeneralProgress, expRequired, EXP_MANUAL_VALUE, AWAKEN_STONE_COST, MAX_AWAKENING } from "./progression.js";
import { calculatePower, passiveCombatBonus, weaknessCombatPenalty, ultimateCombatBonus } from "./combat.js";
import { EQUIPMENT_CATALOG, EQUIPMENT_SLOTS, ensureEquipmentState, craftEquipment, equipItem, unequipItem, enhanceItem, dismantleItem, enhanceCost, equipmentPower, totalEquipmentBonuses } from "./equipment.js";
import { CAMPAIGN_CHAPTERS, CAMPAIGN_STAGE_COUNT, defaultCampaignState, normalizeCampaignState, getCampaignStage, applyCampaignVictory, buildCampaignEnemyTeam } from "./campaign.js";
import { MISSION_DEFS, defaultMissionState, normalizeMissionState, missionMetrics, applyMissionProgress, missionRewardText } from "./missions.js";
import { SHOP_ITEMS, defaultShopState, normalizeShopState, purchaseShopItem } from "./shop.js";
import { portraitHTML, installPortraitFallback } from "./portrait.js";
import { arenaStats, createArenaTeam, alive, arenaOrder, takeArenaTurn, applyArenaAttack, applyArenaAreaSkill, applyArenaHeal, renderArenaTeam } from "./arena.js";
const $=s=>document.querySelector(s), clone=v=>JSON.parse(JSON.stringify(v));
// 화면에 글자를 넣을 때 HTML로 해석되지 않도록 변환합니다. (백업 파일에 악의적인 이름이 있어도 안전)
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let gameState,battle=null,toastTimer,recruitUI;
function seedState(){return {saveFormatVersion:SAVE_FORMAT_VERSION,appDataVersion:APP_VERSION,lord:{level:1,exp:0,gold:1000,gems:0},generals:clone(GENERAL_DATA),inventory:{expManual:3,awakeningStone:0,equipmentMaterials:30,equipmentLeather:10,equipmentJade:0,equipment:[]},settings:{},records:{battleWins:0,battleLosses:0,duelCount:0},campaign:defaultCampaignState(),missions:defaultMissionState(),shop:defaultShopState(),arena:{wins:0,losses:0,points:0}}}
// 새 상태를 저장하고 성공하면 화면에 반영합니다. 저장에 실패하면 이전 상태를 유지하고 오류를 던집니다. (모집·영입처럼 되돌리기 어려운 변경에 사용)
async function commitState(next){const prev=gameState;gameState=next;applyMissionProgress(gameState);try{await saveState(gameState)}catch(e){gameState=prev;throw e}render()}
function notify(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),2200)}
async function persist(){try{await saveState(gameState)}catch(e){console.error(e);notify("저장에 실패했습니다. 백업을 확인해주세요.")}}
installPortraitFallback();
function generalBackHTML(g){return '<div class="general-card-back"><div class="general-back-line"><b>무력 · 지력 · 통솔</b><span>'+esc(g.stats.martial)+' · '+esc(g.stats.intelligence)+' · '+esc(g.stats.leadership)+'</span></div><div class="general-back-line"><b>정치 · 매력</b><span>'+esc(g.stats.politics)+' · '+esc(g.stats.charm)+'</span></div><div class="general-back-line"><b>고유 특성</b><span>'+esc(g.passiveDesc||g.passive||"정보 없음")+'</span></div><div class="general-back-line"><b>필살기 효과</b><span>'+esc(g.skillDesc||g.ultimate||"정보 없음")+'</span></div><div class="general-back-line"><b>전투 약점</b><span>'+esc(g.weaknessDesc||g.weakness||"정보 없음")+'</span></div></div><button type="button" class="general-back-toggle" data-general-back>뒷면 보기</button>'}
function cardTemplate(g){const t=Object.values(g.stats).reduce((a,b)=>a+b,0);return `<article class="general-card" data-general-card="${esc(g.id)}"><button class="general-card-main" data-id="${esc(g.id)}">${portraitHTML(g)}<div class="general-info"><h3>${esc(g.name)}<span class="rank">${esc(g.rank)}</span></h3><div class="meta">${esc(g.faction)} · ${esc(g.style)} · ${g.owned?"보유":"미보유"}</div><div class="power">종합 능력 ${t} · Lv.${g.level||1}</div></div></button>${generalBackHTML(g)}</article>`}
function render(){ $("#roster-count").textContent=gameState.generals.length;$("#owned-count").textContent=gameState.generals.filter(g=>g.owned).length;$("#lord-level").textContent=gameState.lord.level;$("#save-version").textContent=gameState.saveFormatVersion;
const q=$("#search").value.trim().toLowerCase(),f=$("#faction-filter").value,r=$("#rank-filter").value;
const filtered=gameState.generals.filter(g=>(!q||g.name.toLowerCase().includes(q))&&(f==="전체"||g.faction===f)&&(r==="전체"||g.rank===r));
$("#general-grid").innerHTML=filtered.map(cardTemplate).join("")||'<p class="muted">조건에 맞는 장수가 없습니다.</p>';
$("#owned-grid").innerHTML=gameState.generals.filter(g=>g.owned).map(cardTemplate).join("");renderSetup();renderRecords();recruitUI?.render();renderTraining();renderEquipment();renderCampaign();renderMissions();renderShop();renderArena()}
function openGeneral(id){const g=gameState.generals.find(x=>x.id===id);if(!g)return;const st=[["무력",g.stats.martial],["지력",g.stats.intelligence],["통솔",g.stats.leadership],["정치",g.stats.politics],["매력",g.stats.charm]];
$("#general-detail").innerHTML=`${portraitHTML(g,"portrait-detail")}<h2 class="detail-title">${esc(g.name)}</h2><div class="detail-meta">${esc(g.faction)} · ${esc(g.rank)} · ${esc(g.style)}</div><div class="detail-stats">${st.map(([n,v])=>`<div class="stat"><span>${n}</span><strong>${v}</strong></div>`).join("")}</div><div class="detail-section"><h4>${esc(g.passiveName||"고유 특성")}</h4><p>${esc(g.passiveDesc||g.passive)}</p></div><div class="detail-section"><h4>필살기 효과</h4><p>${esc(g.skillDesc||g.ultimate)}</p></div><div class="detail-section"><h4>${esc(g.weaknessName||"전투 약점")}</h4><p>${esc(g.weaknessDesc||g.weakness)}</p></div><div class="detail-section"><p class="muted">※ 능력치는 게임 밸런스를 위한 창작 설계값입니다.</p></div>`;$("#general-dialog").showModal()}
function switchTab(t){if(t==="equipment")renderEquipment();if(t==="campaign")renderCampaign();if(t==="missions")renderMissions();if(t==="shop")renderShop();if(t==="arena")renderArena();document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(`#${t}-view`).classList.remove("hidden");document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===t))}
function downloadJSON(d,n){const blob=new Blob([JSON.stringify(d,null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function exportBackup(){downloadJSON(buildBackup(),`cheonhap-backup-${new Date().toISOString().slice(0,10)}.json`);$("#backup-status").textContent="백업 파일을 만들었습니다. 안전한 위치에 보관하세요."}
function buildBackup(){return {format:"cheonhap-backup",backupVersion:BACKUP_VERSION,appVersion:APP_VERSION,exportedAt:new Date().toISOString(),gameState}}
// 백업 데이터를 검사하고(형식·버전·장수 데이터), 문제가 없을 때만 현재 저장 데이터를 교체합니다.
async function restoreFromParsed(p){
 if(!p||p.format!=="cheonhap-backup"||!p.gameState||!Array.isArray(p.gameState.generals))throw Error("형식이 올바르지 않습니다.");
 if((p.backupVersion||1)>BACKUP_VERSION)throw Error("더 새로운 버전에서 만든 백업입니다. 앱을 업데이트한 뒤 복원해주세요.");
 // 백업 파일은 현재 저장 데이터를 통째로 교체하므로 손상된 파일은 확인창 전에 거부합니다. (기존 데이터 보호)
 const gs=p.gameState;
 if(!gs.lord||typeof gs.lord!=="object"||!Number.isFinite(gs.lord.gold))throw Error("군주 정보가 손상된 백업입니다. 복원하지 않았습니다.");
 if(gs.generals.length<1||gs.generals.some(g=>!g||typeof g.id!=="string"||!g.stats||typeof g.stats!=="object"))throw Error("장수 데이터가 손상된 백업입니다. 복원하지 않았습니다.");
 const candidate=normalizeState(migrateState(clone(p.gameState)));
 if(!confirm("현재 저장 데이터를 백업 파일 내용으로 교체할까요?"))return false;
 const previous=gameState;gameState=candidate;
 try{await replaceState(gameState)}catch(e){gameState=previous;throw Error("저장에 실패하여 복원을 취소했습니다. 기존 데이터는 그대로입니다.")}
 resetBattle();render();return true;
}
async function importBackup(){const f=$("#import-file").files[0];if(!f){$("#backup-status").textContent="먼저 백업 JSON 파일을 선택해주세요.";return}
 try{const ok=await restoreFromParsed(JSON.parse(await f.text()));if(ok){$("#backup-status").textContent="복원이 완료되었습니다.";$("#import-file").value=""}}catch(e){$("#backup-status").textContent=`복원 실패: ${e.message}`}}
// 파일 저장이 막히는 환경(예: 일부 Android WebView)을 위한 대체 수단: 백업 내용을 텍스트로 복사/붙여넣기
async function copyBackupText(){const text=JSON.stringify(buildBackup());try{await navigator.clipboard.writeText(text);$("#backup-status").textContent="백업 내용을 복사했습니다. 메모 앱 등에 붙여넣어 보관하세요."}catch(e){const ta=$("#paste-backup");ta.value=text;ta.select();$("#backup-status").textContent="자동 복사에 실패했습니다. 아래 칸의 내용을 직접 복사해 보관하세요."}}
async function importBackupText(){const t=$("#paste-backup").value.trim();if(!t){$("#backup-status").textContent="붙여넣은 백업 내용이 없습니다.";return}
 try{const ok=await restoreFromParsed(JSON.parse(t));if(ok){$("#backup-status").textContent="복원이 완료되었습니다.";$("#paste-backup").value=""}}catch(e){$("#backup-status").textContent=`복원 실패: ${e.message}`}}
function renderRecords(){const r=gameState.records||{};$("#battle-wins").textContent=r.battleWins||0;$("#battle-losses").textContent=r.battleLosses||0;$("#battle-total").textContent=r.duelCount||0}
function renderSetup(){const selected=battle?.selectedIds||[];$("#battle-roster").innerHTML=gameState.generals.filter(g=>g.owned).map(g=>`<label class="roster-choice ${selected.includes(g.id)?"selected":""}"><input type="checkbox" data-pick="${esc(g.id)}" ${selected.includes(g.id)?"checked":""} ${battle?.active?"disabled":""}>${portraitHTML(g,"portrait-sm")}<span class="choice-name">${esc(g.name)}</span><span class="choice-style">${esc(g.style)}</span><span class="choice-rank">${esc(g.rank)}</span>${generalBackHTML(g)}</label>`).join("");$("#battle-owned-count").textContent=gameState.generals.filter(g=>g.owned).length;$("#start-battle").disabled=selected.length!==3||!!battle?.active}
// [v0.3.1 수정] AI도 플레이어와 같은 규칙으로 3명만 출전합니다. (기존: 내가 고르지 않은 47명 전체에서 매 라운드 최강자를 선택)
function pickEnemyTeam(excludeIds){const pool=gameState.generals.filter(g=>!excludeIds.includes(g.id)).map(g=>g.id);for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool.slice(0,3)}
function startBattle(stageNo=null){const ids=[...(battle?.selectedIds||[])];if(ids.length!==3)return notify("출전 장수 3명을 선택해주세요.");const stage=stageNo?getCampaignStage(stageNo):null;if(stageNo&&(!stage||stageNo>normalizeCampaignState(gameState.campaign).unlockedStage))return notify("아직 도전할 수 없는 전장입니다.");battle={mode:stage?"campaign":"duel",stageNo:stage?.number||null,stageName:stage?.name||null,enemyScale:stage?.scale||1,selectedIds:ids,available:[...ids],enemyPool:stage?buildCampaignEnemyTeam(gameState.generals,stage.enemyFaction,stage.number,ids):pickEnemyTeam(ids),pw:0,ew:0,round:1,active:true,used:[],skillUsed:[]};if(battle.enemyPool.length<3)battle.enemyPool=buildCampaignEnemyTeam(gameState.generals,stage?.enemyFaction||"군웅",stage?.number||1,ids);$("#battle-setup").classList.add("hidden");$("#battle-arena").classList.remove("hidden");$("#next-battle").classList.add("hidden");$("#player-score").textContent="0";$("#enemy-score").textContent="0";$("#round-label").textContent=`${stage?`${esc(stage.name)} · `:""}1라운드`;$("#ultimate-toggle").checked=false;$("#ultimate-toggle").disabled=false;$("#ultimate-hint").textContent="각 장수는 한 번만 출전하므로, 출전할 때마다 필살기 사용 여부를 고를 수 있습니다.";$("#player-card").textContent="출전 장수를 선택하세요.";$("#enemy-card").textContent="AI 대기 중";$("#round-result").textContent="이번 라운드에 출전할 장수를 선택하세요.";renderChoices();renderSetup()}
function beats(a,b){return (a==="공격형"&&b==="전술형")||(a==="전술형"&&b==="진형형")||(a==="진형형"&&b==="공격형")}
function power(g){return calculatePower(g,gameState.inventory.equipment||[])}
function battlePower(g,isEnemy=false){return power(g)*(isEnemy?(battle?.enemyScale||1):1)}
function passiveBonus(g){return passiveCombatBonus(g)}
function weaknessPenalty(g,opp){return weaknessCombatPenalty(g,opp)}
function skillBonus(g,opp,advantage){return ultimateCombatBonus(g,advantage)}
function renderChoices(){const a=battle.available.map(id=>gameState.generals.find(g=>g.id===id));$("#battle-choices").innerHTML=a.map(g=>`<article class="choice-card"><button class="choice-btn" data-fight="${esc(g.id)}">${portraitHTML(g,"portrait-choice")}<strong>${esc(g.name)}</strong><span>${esc(g.style)}</span></button>${generalBackHTML(g)}</article>`).join("")||'<p class="muted">출전 가능한 장수가 없습니다.</p>'}
async function playRound(id){
if(!battle?.active||!battle.available.includes(id))return;
const p=gameState.generals.find(g=>g.id===id);
const pool=battle.enemyPool.map(x=>gameState.generals.find(g=>g.id===x)).filter(Boolean);
if(!pool.length)return finishBattle();
const playerSkill=$("#ultimate-toggle").checked&&!battle.skillUsed.includes(id);
const styleAdv=(a,b)=>beats(a,b)?1:beats(b,a)?-1:0;
// [v0.3.1 수정] AI는 플레이어가 이번에 낼 카드를 알 수 없습니다.
// 플레이어가 아직 낼 수 있는 장수 전체(내 출전 장수 중 남은 장수)를 기준으로 "기대 상성"을 계산해 고릅니다.
const foes=battle.available.map(x=>gameState.generals.find(g=>g.id===x)).filter(Boolean);
const avgInt=foes.reduce((a,f)=>a+f.stats.intelligence,0)/foes.length;
const avgPower=foes.reduce((a,f)=>a+battlePower(f),0)/foes.length;
const aiChoice=pool.map(g=>{
 const counter=foes.reduce((a,f)=>a+styleAdv(g.style,f.style),0)/foes.length;
 const score=counter*14+power(g)*.2+(g.stats.intelligence-avgInt)*.08+Math.random()*8;
 return {g,score,counter};
}).sort((a,b)=>b.score-a.score)[0];
const e=aiChoice.g;
const aiSkill= !battle.skillUsed.includes(e.id) &&
 (aiChoice.counter<0 || battlePower(e,true)<avgPower || (battle.ew<battle.pw));
battle.available=battle.available.filter(x=>x!==id);
battle.enemyPool=battle.enemyPool.filter(x=>x!==e.id);
battle.used.push(id,e.id);
if(playerSkill)battle.skillUsed.push(id);
if(aiSkill)battle.skillUsed.push(e.id);
const playerCounter=styleAdv(p.style,e.style);
const enemyCounter=styleAdv(e.style,p.style);
const pSkillBonus=playerSkill?skillBonus(p,e,playerCounter):0;
const eSkillBonus=aiSkill?skillBonus(e,p,enemyCounter):0;
const pScore=battlePower(p)+playerCounter*11+passiveBonus(p)-weaknessPenalty(p,e)+pSkillBonus+(Math.random()*10-5);
const eScore=battlePower(e,true)+enemyCounter*11+passiveBonus(e)-weaknessPenalty(e,p)+eSkillBonus+(Math.random()*10-5);
const won=pScore>=eScore;
if(won)battle.pw++;else battle.ew++;
$("#player-card").innerHTML=`<strong>${esc(p.name)}</strong><span>${esc(p.style)} · 전투력 ${Math.round(power(p))}${playerSkill?" · 필살기 발동":""}</span>`;
$("#enemy-card").innerHTML=`<strong>${esc(e.name)}</strong><span>${esc(e.style)} · 전투력 ${Math.round(power(e))}${aiSkill?" · 필살기 발동":""}</span>`;
$("#player-score").textContent=battle.pw;$("#enemy-score").textContent=battle.ew;
$("#round-label").textContent=`${battle.round}라운드 결과`;
const matchup=playerCounter>0?"상성 우위":playerCounter<0?"상성 열세":"상성 동률";
$("#round-result").innerHTML=`<strong>${won?"이번 라운드 승리":"이번 라운드 패배"}</strong><span>${matchup} · ${esc(p.name)} vs ${esc(e.name)}</span><span>${playerSkill?"내 장수 필살기 발동 · ":""}${aiSkill?"상대 필살기 발동":"상대 필살기 미사용"}</span>`;
$("#ultimate-toggle").checked=false;
if(battle.pw===2||battle.ew===2||battle.round===3){finishBattle();return;}
battle.round++;
$("#round-label").textContent=`${battle.stageName?`${esc(battle.stageName)} · `:""}${battle.round}라운드`;
$("#round-result").innerHTML+="<p>다음 라운드에 출전할 장수를 선택하세요.</p>";
$("#ultimate-hint").textContent="다음 장수의 필살기 사용 여부를 선택할 수 있습니다.";
renderChoices();
}
async function finishBattle(){battle.active=false;const previousState=clone(gameState);const win=battle.pw>battle.ew;let campaignResult=null;gameState.records=gameState.records||{};gameState.records.duelCount=(gameState.records.duelCount||0)+1;if(battle.mode==="campaign"){if(win){campaignResult=applyCampaignVictory(gameState,battle.stageNo);gameState.records.battleWins=(gameState.records.battleWins||0)+1}else gameState.records.battleLosses=(gameState.records.battleLosses||0)+1;}else if(win){gameState.records.battleWins=(gameState.records.battleWins||0)+1;gameState.lord.gold+=150;gameState.inventory.expManual=(gameState.inventory.expManual||0)+1;gameState.inventory.equipmentMaterials=(gameState.inventory.equipmentMaterials||0)+2;gameState.inventory.equipmentLeather=(gameState.inventory.equipmentLeather||0)+1;if(gameState.records.battleWins%3===0)gameState.inventory.awakeningStone=(gameState.inventory.awakeningStone||0)+1}else{gameState.records.battleLosses=(gameState.records.battleLosses||0)+1;gameState.lord.gold+=60;gameState.inventory.equipmentMaterials=(gameState.inventory.equipmentMaterials||0)+1}if(battle.mode!=="campaign"||win)for(const id of (battle.selectedIds||[])){const g=gameState.generals.find(x=>x.id===id);if(g?.owned){const r=addExperience(g,win?40:20);Object.assign(g,r.general)}}const newMissions=applyMissionProgress(gameState);try{await saveState(gameState)}catch(e){gameState=previousState;console.error(e);render();$("#battle-choices").innerHTML="";$("#next-battle").classList.remove("hidden");notify("전투 결과 저장에 실패했습니다. 보상과 진행도는 반영하지 않았습니다.");return}renderRecords();renderTraining();renderEquipment();renderCampaign();renderMissions();const rewardText=battle.mode==="campaign"?(win?`금화 ${campaignResult.reward.gold} · 철광석 ${campaignResult.reward.materials} · 가죽 ${campaignResult.reward.leather} · 옥 ${campaignResult.reward.jade}${campaignResult.firstClear?" · 최초 승리 보상":" · 반복 보상"}`:"패배: 전장 보상과 진행도는 지급되지 않습니다."):(win?"금화 150개 획득":"참가 보상 금화 60개 획득");$("#round-result").innerHTML=`<strong>${win?"전투 승리!":"전투 패배"}</strong><span>${esc(rewardText)}</span>`;$("#battle-choices").innerHTML="";$("#next-battle").classList.remove("hidden");notify(newMissions.length?`업적 ${newMissions.length}개 달성! 보상을 받았습니다.`:(win?"전투에서 승리했습니다!":"전투가 종료되었습니다."))}
function resetBattle(){battle={selectedIds:[],active:false};$("#battle-arena").classList.add("hidden");$("#battle-setup").classList.remove("hidden");renderSetup()}
// 저장 데이터를 최신 구조로 맞춥니다. 불러오기(init)와 백업 복원이 같은 함수를 사용합니다.
// 원칙: 저장된 보유 여부·레벨·경험치·능력치는 유지하고, 새 장수 추가와 표시용 설명 필드만 최신으로 보완합니다.
function normalizeState(input){
 const st={...input};
 if(!Array.isArray(st.generals))throw Error("장수 데이터가 없습니다.");
 const seen=new Set();
 st.generals=st.generals.filter(g=>g&&typeof g.id==="string"&&g.stats&&typeof g.stats==="object"&&!seen.has(g.id)&&seen.add(g.id));
 for(const fresh of GENERAL_DATA){
  const old=st.generals.find(g=>g.id===fresh.id);
  if(!old){const added=clone(fresh);normalizeGeneralProgress(added);st.generals.push(added);continue}
  for(const k of ["name","faction","rank","style"])if(!old[k])old[k]=fresh[k];
  old.stats={...fresh.stats,...old.stats};
  old.owned=!!old.owned;normalizeGeneralProgress(old);old.combatEffects=clone(fresh.combatEffects);
  old.portrait=fresh.portrait??null; // 초상화 경로는 표시용 정적 값이므로 기존 저장 데이터에도 최신 경로를 반영합니다. (능력치·진행도는 건드리지 않음)
  for(const k of ["skillName","skillDesc","passiveName","passiveDesc","weaknessName","weaknessDesc","passive","ultimate","weakness"])old[k]=fresh[k];
 }
 st.lord={level:1,exp:0,gold:0,gems:0,...(st.lord&&typeof st.lord==="object"?st.lord:{})};
 st.lord.gold=Number.isFinite(st.lord.gold)?Math.max(0,Math.floor(st.lord.gold)):0;
 st.inventory=st.inventory||{};ensureEquipmentState(st);if(st.inventory.expManual==null)st.inventory.expManual=3;if(st.inventory.awakeningStone==null)st.inventory.awakeningStone=0;st.inventory.expManual=Math.max(0,Math.floor(Number(st.inventory.expManual)||0));st.inventory.awakeningStone=Math.max(0,Math.floor(Number(st.inventory.awakeningStone)||0));st.settings=st.settings||{};
 st.records={battleWins:0,battleLosses:0,duelCount:0,...(st.records||{})};
 st.arena={wins:0,losses:0,points:0,...(st.arena||{})};
 st.campaign=normalizeCampaignState(st.campaign||defaultCampaignState());st.missions=normalizeMissionState(st.missions||defaultMissionState());st.shop=normalizeShopState(st.shop||defaultShopState());
 ensureRecruitState(st);
 st.saveFormatVersion=SAVE_FORMAT_VERSION;st.appDataVersion=APP_VERSION;
 return st;
}


let arenaSelection=[],arenaBattle=null;
function renderArena(){
 const host=$("#arena-roster");if(!host)return;const owned=gameState.generals.filter(g=>g.owned);
 arenaSelection=arenaSelection.filter(id=>owned.some(g=>g.id===id));if(!arenaSelection.length)arenaSelection=owned.slice(0,4).map(g=>g.id);
 host.innerHTML=owned.map(g=>{const st=arenaStats(g,gameState.inventory.equipment||[]),on=arenaSelection.includes(g.id);return `<label class="arena-pick ${on?"selected":""}"><input type="checkbox" data-arena-pick="${esc(g.id)}" ${on?"checked":""} ${arenaSelection.length>=4&&!on?"disabled":""}><span><b>${esc(g.name)}</b><small>${esc(g.faction)} · ${esc(g.rank)} · Lv.${g.level||1}</small><small>HP ${st.hp} · ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}</small><small class="arena-pick-trait">필살기 효과 · ${esc(st.skill.description)}</small></span>${generalBackHTML(g)}</label>`}).join("")||'<p class="muted">보유 장수가 없습니다.</p>';
 $("#arena-selected-count").textContent=`${arenaSelection.length} / 4`;$("#arena-start").disabled=arenaSelection.length!==4;
}
function arenaMessage(message){const el=$("#arena-turn-message");if(el)el.textContent=""}
function renderArenaActions(){const host=$("#arena-action-options");if(host)host.innerHTML="";}
function renderArenaBattle(){
 if(!arenaBattle)return;
 const {player,enemy,actorId,phase}=arenaBattle;
 $("#arena-result").classList.remove("hidden");
 $("#arena-enemy-alive").textContent=enemy.filter(x=>x.hp>0).length;$("#arena-player-alive").textContent=player.filter(x=>x.hp>0).length;
 $("#arena-enemy-team").innerHTML=renderArenaTeam(gameState.generals,enemy,{activeId:actorId,selectable:phase==="target"||phase==="skill-target"});
 $("#arena-player-team").innerHTML=renderArenaTeam(gameState.generals,player,{activeId:actorId,healable:phase==="heal-target",excludeId:actorId,turnActions:phase==="action"});
 renderArenaActions();
}
function completeArenaAction(actor){
 arenaBattle.actedIds.push(actor.id);arenaBattle.phase="resolving";renderArenaBattle();window.setTimeout(nextArenaActor,650);
}
function playArenaImpact(actorId,targetIds){
 const targets=(Array.isArray(targetIds)?targetIds:[targetIds]).filter(Boolean);
 try{if(typeof navigator!=="undefined"&&typeof navigator.vibrate==="function")navigator.vibrate([28,18,42])}catch(e){}
 requestAnimationFrame(()=>{const actor=document.querySelector('#arena-'+(arenaBattle?.player.some(x=>x.id===actorId)?'player':'enemy')+'-team .arena-unit[data-unit-id="'+CSS.escape(String(actorId))+'"]');if(actor){actor.classList.remove('arena-strike-player','arena-strike-enemy');void actor.offsetWidth;actor.classList.add(actor.closest('#arena-player-team')?'arena-strike-player':'arena-strike-enemy');}
 targets.forEach(id=>{const card=document.querySelector('.arena-unit[data-unit-id="'+CSS.escape(String(id))+'"]');if(card){card.classList.remove('arena-hit');void card.offsetWidth;card.classList.add('arena-hit');}});
 window.setTimeout(()=>document.querySelectorAll('.arena-strike-player,.arena-strike-enemy,.arena-hit').forEach(el=>el.classList.remove('arena-strike-player','arena-strike-enemy','arena-hit')),520);
 });
}
function chooseEnemyTarget(foes){
 if(!foes.length)return null;
 const mode=Math.random();
 if(mode<.28)return foes[Math.floor(Math.random()*foes.length)]; // 전술 실수·허술한 선택
 if(mode<.62)return [...foes].sort((a,b)=>(b.stats.atk+b.stats.def*.35)-(a.stats.atk+a.stats.def*.35))[0]; // 강한 장수를 노리는 무모한 공격
 if(mode<.82)return [...foes].sort((a,b)=>a.hp/a.stats.maxHp-b.hp/b.stats.maxHp)[0]; // 빈사 장수 우선
 return [...foes].sort((a,b)=>(a.hp/a.stats.maxHp + a.stats.def/300)-(b.hp/b.stats.maxHp + b.stats.def/300))[0]; // 약한 방어·체력 집중
}
function nextArenaActor(){
 if(!arenaBattle||arenaBattle.finished)return;
 if(!alive(arenaBattle.player).length||!alive(arenaBattle.enemy).length)return finishArena();
 const order=arenaOrder(arenaBattle.player,arenaBattle.enemy),actor=order.find(u=>!arenaBattle.actedIds.includes(u.id));
 if(!actor){arenaBattle.actedIds=[];return nextArenaActor()}
 arenaBattle.actorId=actor.id;
 if(actor.team==="player"){
  arenaBattle.phase="action";arenaMessage(`내 차례: ${actor.name}. 일반 공격 또는 필살기를 선택하세요.`);renderArenaBattle();return;
 }
 arenaBattle.phase="enemy";const foes=alive(arenaBattle.player),friends=alive(arenaBattle.enemy);
 const target=chooseEnemyTarget(foes);
 arenaMessage(`상대 차례: ${actor.name}의 행동`);renderArenaBattle();
 window.setTimeout(()=>{
  if(!arenaBattle||arenaBattle.actorId!==actor.id)return;
  const skill=actor.skillCooldown<=0&&Math.random()<.48;
  let hitIds=[];
  if(skill&&actor.skill.kind==="allAttack"){applyArenaAreaSkill(actor,foes,arenaBattle.log);hitIds=foes.map(x=>x.id)}
  else if(skill&&actor.skill.kind==="ally"){
   const ally=friends.filter(x=>x.hp<x.stats.maxHp).sort((a,b)=>a.hp/a.stats.maxHp-b.hp/b.stats.maxHp)[0];
   if(ally)applyArenaHeal(actor,ally,arenaBattle.log);else {applyArenaAttack(actor,target,arenaBattle.log,false);hitIds=[target.id]}
  }else {applyArenaAttack(actor,target,arenaBattle.log,skill);hitIds=[target.id]}
  arenaBattle.actedIds.push(actor.id);arenaBattle.phase="resolving";renderArenaBattle();if(hitIds.length)playArenaImpact(actor.id,hitIds);window.setTimeout(nextArenaActor,700);
 },550);
}
function startArena(){
 if(arenaSelection.length!==4)return notify("아레나 출전 장수 4명을 선택해주세요.");
 const pool=gameState.generals.filter(g=>!arenaSelection.includes(g.id));
 const enemy=[...pool].sort((a,b)=>calculatePower(b,gameState.inventory.equipment||[])-calculatePower(a,gameState.inventory.equipment||[])).slice(0,4).map(g=>g.id);
 if(enemy.length<4)return notify("대전 상대 장수가 부족합니다.");
 arenaBattle={player:createArenaTeam(gameState.generals,arenaSelection,gameState.inventory.equipment||[]),enemy:createArenaTeam(gameState.generals,enemy,gameState.inventory.equipment||[],true),actorId:null,phase:"",actedIds:[],log:[],finished:false};
 $("#arena-start").disabled=true;$("#arena-setup").classList.add("hidden");$("#arena-result").classList.remove("hidden");
 $("#arena-action-controls").classList.remove("hidden");$("#arena-turn-message").textContent="";
 $("#arena-player-team").innerHTML="";$("#arena-enemy-team").innerHTML="";renderArenaBattle();window.setTimeout(nextArenaActor,450);
}
function chooseArenaAction(action){
 if(!arenaBattle||arenaBattle.phase!=="action")return;
 const actor=arenaBattle.player.find(x=>x.id===arenaBattle.actorId);if(!actor)return;
 if(action==="attack"){arenaBattle.phase="target";arenaMessage(actor.name+"의 일반 공격: 위쪽 적 카드에서 대상을 선택하세요.");renderArenaBattle();return}
 if(action!=="skill"||actor.skillCooldown>0)return;
 if(actor.skill.kind==="ally"){
  arenaBattle.phase="heal-target";arenaMessage(actor.name+"의 회복 필살기: 아래쪽 아군 카드에서 자신을 포함해 대상을 선택하세요.");renderArenaBattle();return;
 }
 if(actor.skill.kind==="allAttack"){const targets=alive(arenaBattle.enemy);applyArenaAreaSkill(actor,targets,arenaBattle.log);arenaMessage(actor.name+"의 광역 필살기 발동!");playArenaImpact(actor.id,targets.map(x=>x.id));completeArenaAction(actor);return;}
 if(actor.skill.kind==="self"){
  const target=alive(arenaBattle.enemy)[0];applyArenaAttack(actor,target,arenaBattle.log,true);arenaMessage(actor.name+" 필살기 발동!");playArenaImpact(actor.id,target.id);completeArenaAction(actor);return;
 }
 arenaBattle.phase="skill-target";arenaMessage(actor.name+" 필살기: 위쪽 적 카드에서 대상을 선택하세요.");renderArenaBattle();
}
function chooseArenaTarget(id,useSkill=false){
 if(!arenaBattle||!["target","skill-target"].includes(arenaBattle.phase))return;
 const actor=arenaBattle.player.find(x=>x.id===arenaBattle.actorId),target=arenaBattle.enemy.find(x=>x.id===id);
 if(!actor||!target||target.hp<=0)return;
 applyArenaAttack(actor,target,arenaBattle.log,useSkill);arenaMessage(actor.name+" → "+target.name+(useSkill?" 필살기 발동":" 공격"));playArenaImpact(actor.id,target.id);completeArenaAction(actor);
}
function chooseArenaHealTarget(id){
 if(!arenaBattle||arenaBattle.phase!=="heal-target")return;
 const actor=arenaBattle.player.find(x=>x.id===arenaBattle.actorId),target=arenaBattle.player.find(x=>x.id===id);
 if(!actor||!target||target.hp<=0||actor.skill.kind!=="ally")return;
 const result=applyArenaHeal(actor,target,arenaBattle.log);if(!result.ok)return notify(result.reason||"회복할 수 없습니다.");
 arenaMessage(actor.name+"이(가) "+target.name+"의 체력을 회복했습니다.");completeArenaAction(actor);
}
async function finishArena(forfeit=false){
 if(!arenaBattle||arenaBattle.finished)return;arenaBattle.finished=true;
 const win=!forfeit&&alive(arenaBattle.player).length>0,next=clone(gameState);next.arena=next.arena||{wins:0,losses:0,points:0};
 if(win){next.arena.wins++;next.arena.points+=20}else next.arena.losses++;
 await commitState(next);arenaMessage(win?"승리! 아레나 포인트 20점을 획득했습니다.":forfeit?"기권패 처리되었습니다.":"패배했습니다. 편성을 바꾸어 다시 도전해보세요.");
 arenaBattle.phase="finished";$("#arena-action-controls").classList.add("hidden");$("#arena-forfeit").classList.add("hidden");$("#arena-again").classList.remove("hidden");renderArenaBattle();notify(win?"아레나 승리! 20 포인트를 획득했습니다.":forfeit?"아레나 기권패 처리되었습니다.":"아레나 패배.");
}
function resetArena(){arenaBattle=null;$("#arena-result").classList.add("hidden");$("#arena-setup").classList.remove("hidden");$("#arena-action-controls").classList.add("hidden");$("#arena-again").classList.add("hidden");$("#arena-forfeit").classList.remove("hidden");$("#arena-start").disabled=arenaSelection.length!==4;renderArena()}
function renderTraining(){const host=$("#training-list");if(!host)return;const owned=gameState.generals.filter(g=>g.owned);$("#training-manuals").textContent=gameState.inventory.expManual||0;$("#training-stones").textContent=gameState.inventory.awakeningStone||0;host.innerHTML=owned.map(g=>{normalizeGeneralProgress(g);const need=g.level>=30?0:expRequired(g.level);const pct=need?Math.min(100,g.exp/need*100):100;return `<article class="training-card"><div class="training-head">${portraitHTML(g)}<div class="training-name"><strong>${esc(g.name)}</strong><span>${esc(g.rank)} · Lv.${g.level} · 각성 ${g.awakening}/${MAX_AWAKENING}</span></div></div>${generalBackHTML(g)}<div class="training-progress"><div class="training-progress-fill" style="width:${pct}%"></div></div><p class="muted small">${g.level>=30?"최고 레벨":"경험치 "+g.exp+" / "+need}</p><div class="training-actions"><button class="secondary-btn" data-train="${esc(g.id)}" ${!gameState.inventory.expManual||g.level>=30?"disabled":""}>경험서 사용 (+${EXP_MANUAL_VALUE})</button><button class="primary-btn" data-awaken="${esc(g.id)}" ${!gameState.inventory.awakeningStone||g.awakening>=MAX_AWAKENING?"disabled":""}>각성 (${AWAKEN_STONE_COST}개)</button></div></article>`}).join("")||'<p class="muted">보유한 장수가 없습니다. 먼저 장수를 모집하세요.</p>'}
async function trainGeneral(id){const g=gameState.generals.find(x=>x.id===id);if(!g||!g.owned)return;if((gameState.inventory.expManual||0)<1)return notify("경험서가 부족합니다.");if(g.level>=30)return notify("이미 최고 레벨입니다.");const next=clone(gameState);next.inventory.expManual--;const idx=next.generals.findIndex(x=>x.id===id);const result=addExperience(next.generals[idx],EXP_MANUAL_VALUE);next.generals[idx]=result.general;await commitState(next);notify(`${g.name} 경험치 +${EXP_MANUAL_VALUE}${result.levels?` · 레벨 ${result.general.level} 달성`:""}`)}
async function awaken(id){const res=awakenGeneral(gameState,id);if(!res.ok)return notify(res.reason);await commitState(res.state);notify(`${res.general.name} 각성 ${res.general.awakening}단계 달성!`)}

function renderMissions(){const host=$("#mission-list");if(!host)return;const metrics=missionMetrics(gameState),done=new Set(normalizeMissionState(gameState.missions).completedIds);const groups=[...new Set(MISSION_DEFS.map(m=>m.category))];host.innerHTML=groups.map(group=>`<section class="mission-group"><h3>${esc(group)}</h3><div class="mission-grid">${MISSION_DEFS.filter(m=>m.category===group).map(m=>{const value=Math.min(metrics[m.metric]||0,m.target),complete=done.has(m.id);return `<article class="mission-card ${complete?"mission-complete":""}"><div class="mission-head"><strong>${esc(m.title)}</strong><span>${complete?"달성 완료":"진행 중"}</span></div><p>${esc(m.description)}</p><div class="mission-progress"><div style="width:${Math.min(100,value/m.target*100)}%"></div></div><div class="mission-foot"><small>${value.toLocaleString()} / ${m.target.toLocaleString()}</small><small>${complete?"보상 지급 완료":esc(missionRewardText(m.reward))}</small></div></article>`}).join("")}</div></section>`).join("");const count=done.size;$("#mission-summary").textContent=`${count} / ${MISSION_DEFS.length}개 업적 달성 · 완료 시 보상 자동 지급`; }
function renderCampaign(){const host=$("#campaign-stages");if(!host)return;const c=normalizeCampaignState(gameState.campaign);gameState.campaign=c;host.innerHTML=CAMPAIGN_CHAPTERS.map((chapter,ci)=>`<section class="campaign-chapter"><div class="campaign-chapter-head"><div><h3>${esc(chapter.name)}</h3><p class="muted small">${esc(chapter.subtitle)}</p></div><span class="campaign-faction">적 세력 · ${esc(chapter.faction)}</span></div><div class="campaign-stage-grid">${chapter.stages.map((entry,si)=>{const n=ci*5+si+1,cleared=c.clearedStages.includes(n),locked=n>c.unlockedStage;const stage=getCampaignStage(n);return `<article class="campaign-stage ${locked?"locked":""} ${cleared?"cleared":""}"><div class="stage-top"><strong>${String(n).padStart(2,"0")}. ${esc(entry[0])}</strong><span>${cleared?"승리 완료":locked?"잠김":"도전 가능"}</span></div><p>${esc(entry[1])}</p><small>반복 보상 · 금화 ${stage.repeat.gold} / 철광석 ${stage.repeat.materials}${stage.repeat.leather?` / 가죽 ${stage.repeat.leather}`:""}${stage.repeat.jade?` / 옥 ${stage.repeat.jade}`:""}</small><button class="${locked?"secondary-btn":"primary-btn"}" data-stage="${n}" ${locked?"disabled":""}>${cleared?"다시 도전":"전투 시작"}</button></article>`}).join("")}</div></section>`).join("");$("#campaign-progress").textContent=`${c.clearedStages.length} / ${CAMPAIGN_STAGE_COUNT} 스테이지 최초 승리 · 다음 개방 ${Math.min(c.unlockedStage,CAMPAIGN_STAGE_COUNT)}단계`;}

function renderShop(){const host=$("#shop-items");if(!host)return;const shop=normalizeShopState(gameState.shop);gameState.shop=shop;$("#shop-gold").textContent=(gameState.lord.gold||0).toLocaleString();$("#shop-purchases").textContent=`${shop.purchaseCount.toLocaleString()}회`;$("#shop-spent").textContent=shop.totalGoldSpent.toLocaleString();host.innerHTML=SHOP_ITEMS.map(item=>`<article class="shop-item"><div class="shop-item-copy"><strong>${esc(item.name)}</strong><p>${esc(item.description)}</p><span>금화 ${item.price.toLocaleString()}개</span></div><div class="shop-buy"><label class="sr-only" for="qty-${item.id}">구매 수량</label><select id="qty-${item.id}" aria-label="${esc(item.name)} 구매 수량">${[1,2,3,5,10].map(n=>`<option value="${n}">${n}개</option>`).join("")}</select><button class="primary-btn" data-shop-buy="${item.id}">구매</button></div></article>`).join("");}
async function buyShopItem(id){const qty=Number($("#qty-"+id)?.value||1);const result=purchaseShopItem(gameState,id,qty);if(!result.ok)return notify(result.reason);await commitState(result.state);notify(`${result.item.name} ${qty}개를 구매했습니다.`)}

function renderEquipment(){
 const owned=gameState.generals.filter(g=>g.owned),select=$("#equipment-general");if(!select)return;
 const previous=select.value;select.innerHTML=owned.map(g=>`<option value="${esc(g.id)}">${esc(g.name)} · Lv.${g.level||1}</option>`).join("");if(owned.some(g=>g.id===previous))select.value=previous;
 $("#equip-materials").textContent=gameState.inventory.equipmentMaterials||0;$("#equip-leather").textContent=gameState.inventory.equipmentLeather||0;$("#equip-jade").textContent=gameState.inventory.equipmentJade||0;$("#equip-gold").textContent=gameState.lord.gold;
 $("#equipment-recipe").innerHTML=EQUIPMENT_CATALOG.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.rank)} · 금화 ${x.craftGold}/철광석 ${x.craftMaterial}${x.rank!=="일반"?`/가죽 ${Math.ceil(x.craftMaterial/3)}`:""}${x.rank==="전설"?"/옥 2":""}</option>`).join("");
 const g=owned.find(x=>x.id===select.value)||owned[0];if(!g){$("#equipment-slots").innerHTML="<p class=muted>보유 장수가 없습니다.</p>";return;}
 const inv=gameState.inventory.equipment||[];const bonus=totalEquipmentBonuses(g,inv);
 $("#equipment-slots").innerHTML=EQUIPMENT_SLOTS.map(slot=>{const id=g.equipment?.[slot],item=inv.find(x=>x.uid===id);return `<div class="equipment-row"><span><b>${slot}</b><br><span class="muted">${item?`${esc(item.name)} +${item.enhance} · 전투력 +${equipmentPower(item).toFixed(1)}`:"비어 있음"}</span></span>${item?`<button class="secondary-btn" data-unequip="${slot}">해제</button>`:""}</div>`}).join("")+`<p class="muted small">세트 효과: ${bonus.sets.length?bonus.sets.map(esc).join(" · "):"없음"} · 장비 전투력 +${bonus.power.toFixed(1)}</p>`;
 $("#equipment-inventory").innerHTML=inv.map(item=>{const equipped=gameState.generals.some(x=>Object.values(x.equipment||{}).includes(item.uid));const cost=enhanceCost(item);return `<div class="equipment-item"><div><b>${esc(item.name)} +${item.enhance}</b><small>${esc(item.rank)} · ${esc(item.slot)} · ${esc(item.set)} · ${item.stat} +${equipmentPower(item).toFixed(1)}</small></div><div class="equipment-actions">${!equipped?`<button class="secondary-btn" data-equip="${esc(item.uid)}">장착</button>`:""}<button class="secondary-btn" data-enhance="${esc(item.uid)}" ${item.enhance>=10?"disabled":""}>강화 ${cost.gold}G/${cost.materials}개</button><button class="secondary-btn" data-dismantle="${esc(item.uid)}" ${equipped?"disabled":""}>분해</button></div></div>`}).join("")||'<p class="muted">보유 장비가 없습니다. 장비 제작을 이용하세요.</p>';
}
async function equipmentAction(result,success){if(!result.ok)return notify(result.reason);await commitState(result.state);notify(success)}
async function craftSelectedEquipment(){await equipmentAction(craftEquipment(gameState,$("#equipment-recipe").value),"장비를 제작했습니다.")}
async function init(){let loaded=await loadState(seedState());
if(!loaded||!Array.isArray(loaded.generals)){try{await saveRecovery(loaded)}catch(e){console.error(e)}loaded=seedState()}
gameState=normalizeState(loaded);
const startupMissions=applyMissionProgress(gameState);
await persist();if(startupMissions.length)notify(`업적 ${startupMissions.length}개 달성! 보상을 받았습니다.`);
recruitUI=createRecruitUI({$,esc,getState:()=>gameState,commit:commitState,notify});recruitUI.init();render();
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));$("#search").addEventListener("input",render);$("#faction-filter").addEventListener("change",render);$("#rank-filter").addEventListener("change",render);
document.addEventListener("click",e=>{const flip=e.target.closest("[data-arena-flip]");if(flip){const card=flip.closest(".arena-unit");if(card)card.classList.toggle("is-flipped");return}const back=e.target.closest("[data-general-back]");if(back){e.preventDefault();e.stopPropagation();const card=back.closest(".general-card,.training-card,.roster-choice,.arena-pick,.choice-card,.result-card");if(card){card.classList.toggle("is-flipped");back.textContent=card.classList.contains("is-flipped")?"앞면 보기":"뒷면 보기"}return}const c=e.target.closest(".general-card-main");if(c)openGeneral(c.dataset.id);const f=e.target.closest("[data-fight]");if(f)playRound(f.dataset.fight);const t=e.target.closest("[data-train]");if(t)trainGeneral(t.dataset.train);const a=e.target.closest("[data-awaken]");if(a)awaken(a.dataset.awaken)});
$("#campaign-stages").addEventListener("click",e=>{const b=e.target.closest("button[data-stage]");if(!b)return;const n=Number(b.dataset.stage);if(n>normalizeCampaignState(gameState.campaign).unlockedStage)return notify("이전 전장을 먼저 승리해주세요.");if((battle?.selectedIds||[]).length!==3){switchTab("battle");notify("전장에 출전할 장수 3명을 먼저 선택해주세요.");return}startBattle(n);switchTab("battle");});
$("#shop-items").addEventListener("click",async e=>{const b=e.target.closest("button[data-shop-buy]");if(b)await buyShopItem(b.dataset.shopBuy)});$("#equipment-general").addEventListener("change",renderEquipment);$("#equipment-craft").addEventListener("click",craftSelectedEquipment);$("#equipment-view").addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const id=$("#equipment-general").value;if(b.dataset.equip)await equipmentAction(equipItem(gameState,id,b.dataset.equip),"장비를 장착했습니다.");if(b.dataset.unequip)await equipmentAction(unequipItem(gameState,id,b.dataset.unequip),"장비를 해제했습니다.");if(b.dataset.enhance)await equipmentAction(enhanceItem(gameState,b.dataset.enhance),"강화에 성공했습니다. 장비는 파괴되지 않습니다.");if(b.dataset.dismantle)await equipmentAction(dismantleItem(gameState,b.dataset.dismantle),"장비를 분해했습니다.")});
$("#battle-roster").addEventListener("change",e=>{const id=e.target.dataset.pick;if(!id)return;battle=battle||{selectedIds:[],active:false};if(e.target.checked){if(battle.selectedIds.length<3)battle.selectedIds.push(id);else e.target.checked=false}else battle.selectedIds=battle.selectedIds.filter(x=>x!==id);renderSetup()});
$("#start-battle").addEventListener("click",()=>startBattle());$("#arena-roster").addEventListener("change",e=>{const id=e.target.dataset.arenaPick;if(!id)return;if(e.target.checked){if(arenaSelection.length<4)arenaSelection.push(id);else e.target.checked=false}else arenaSelection=arenaSelection.filter(x=>x!==id);renderArena()});$("#arena-start").addEventListener("click",startArena);$("#arena-again").addEventListener("click",resetArena);$("#arena-forfeit").addEventListener("click",()=>{if(arenaBattle&&!arenaBattle.finished&&window.confirm("정말 기권하시겠습니까? 기권하면 즉시 패배로 기록됩니다."))finishArena(true)});$("#arena-enemy-team").addEventListener("click",e=>{const card=e.target.closest("[data-arena-card]");if(!card||!arenaBattle)return;if(["target","skill-target"].includes(arenaBattle.phase)){chooseArenaTarget(card.dataset.unitId,arenaBattle.phase==="skill-target");return}if(e.target.closest("button"))return;card.classList.toggle("is-flipped")});
$("#arena-player-team").addEventListener("click",e=>{const card=e.target.closest("[data-arena-card]");if(!card||!arenaBattle)return;const action=e.target.closest("[data-arena-card-action]");if(action){chooseArenaAction(action.dataset.arenaCardAction);return}if(arenaBattle.phase==="heal-target"){chooseArenaHealTarget(card.dataset.unitId);return}if(e.target.closest("button"))return;if(arenaBattle.phase==="action"&&card.dataset.unitId===arenaBattle.actorId){card.classList.toggle("is-flipped");return}card.classList.toggle("is-flipped")});$("#arena-action-options").addEventListener("click",e=>{const b=e.target.closest("[data-arena-action]");if(b)chooseArenaAction(b.dataset.arenaAction)});$("#next-battle").addEventListener("click",resetBattle);$("#close-dialog").addEventListener("click",()=>$("#general-dialog").close());$("#export-btn").addEventListener("click",exportBackup);$("#copy-backup-btn").addEventListener("click",copyBackupText);$("#paste-import-btn").addEventListener("click",importBackupText);document.querySelectorAll("[data-app-version]").forEach(e=>e.textContent=APP_VERSION);$("#import-btn").addEventListener("click",importBackup);if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error)}
init().catch(e=>{console.error(e);document.body.insertAdjacentHTML("beforeend",`<p style="padding:20px;color:#ffb4a9">게임 데이터를 불러오지 못했습니다. ${esc(e.message)} 저장 데이터는 삭제되지 않았습니다.</p>`)});
