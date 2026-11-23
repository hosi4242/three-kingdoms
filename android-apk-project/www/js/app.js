import { GENERAL_DATA } from "./generals.js";
import { loadState, saveState, replaceState, saveRecovery, migrateState, SAVE_FORMAT_VERSION } from "./db.js";
import { APP_VERSION, BACKUP_VERSION } from "./version.js";
import { ensureRecruitState } from "./recruit.js";
import { createRecruitUI } from "./recruit-ui.js";
import { addExperience, awakenGeneral, normalizeGeneralProgress, expRequired, EXP_MANUAL_VALUE, AWAKEN_STONE_COST, MAX_AWAKENING } from "./progression.js";
import { calculatePower, passiveCombatBonus, weaknessCombatPenalty, ultimateCombatBonus } from "./combat.js";
const $=s=>document.querySelector(s), clone=v=>JSON.parse(JSON.stringify(v));
// 화면에 글자를 넣을 때 HTML로 해석되지 않도록 변환합니다. (백업 파일에 악의적인 이름이 있어도 안전)
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let gameState,battle=null,toastTimer,recruitUI;
function seedState(){return {saveFormatVersion:SAVE_FORMAT_VERSION,appDataVersion:APP_VERSION,lord:{level:1,exp:0,gold:1000,gems:0},generals:clone(GENERAL_DATA),inventory:{expManual:3,awakeningStone:0},settings:{},records:{battleWins:0,battleLosses:0,duelCount:0}}}
// 새 상태를 저장하고 성공하면 화면에 반영합니다. 저장에 실패하면 이전 상태를 유지하고 오류를 던집니다. (모집·영입처럼 되돌리기 어려운 변경에 사용)
async function commitState(next){const prev=gameState;gameState=next;try{await saveState(gameState)}catch(e){gameState=prev;throw e}render()}
function notify(m){const e=$("#toast");e.textContent=m;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),2200)}
async function persist(){try{await saveState(gameState)}catch(e){console.error(e);notify("저장에 실패했습니다. 백업을 확인해주세요.")}}
function cardTemplate(g){const t=Object.values(g.stats).reduce((a,b)=>a+b,0);return `<button class="general-card" data-id="${esc(g.id)}"><div class="portrait">${esc(g.name.slice(0,1))}</div><div class="general-info"><h3>${esc(g.name)}<span class="rank">${esc(g.rank)}</span></h3><div class="meta">${esc(g.faction)} · ${esc(g.style)} · ${g.owned?"보유":"미보유"}</div><div class="power">종합 능력 ${t} · Lv.${g.level||1}</div></div></button>`}
function render(){ $("#roster-count").textContent=gameState.generals.length;$("#owned-count").textContent=gameState.generals.filter(g=>g.owned).length;$("#lord-level").textContent=gameState.lord.level;$("#save-version").textContent=gameState.saveFormatVersion;
const q=$("#search").value.trim().toLowerCase(),f=$("#faction-filter").value,r=$("#rank-filter").value;
const filtered=gameState.generals.filter(g=>(!q||g.name.toLowerCase().includes(q))&&(f==="전체"||g.faction===f)&&(r==="전체"||g.rank===r));
$("#general-grid").innerHTML=filtered.map(cardTemplate).join("")||'<p class="muted">조건에 맞는 장수가 없습니다.</p>';
$("#owned-grid").innerHTML=gameState.generals.filter(g=>g.owned).map(cardTemplate).join("");renderSetup();renderRecords();recruitUI?.render();renderTraining()}
function openGeneral(id){const g=gameState.generals.find(x=>x.id===id);if(!g)return;const st=[["무력",g.stats.martial],["지력",g.stats.intelligence],["통솔",g.stats.leadership],["정치",g.stats.politics],["매력",g.stats.charm]];
$("#general-detail").innerHTML=`<div class="portrait" style="width:76px;height:88px;font-size:36px;margin-top:16px">${esc(g.name.slice(0,1))}</div><h2 class="detail-title">${esc(g.name)}</h2><div class="detail-meta">${esc(g.faction)} · ${esc(g.rank)} · ${esc(g.style)}</div><div class="detail-stats">${st.map(([n,v])=>`<div class="stat"><span>${n}</span><strong>${v}</strong></div>`).join("")}</div><div class="detail-section"><h4>${esc(g.passiveName||"고유 특성")}</h4><p>${esc(g.passiveDesc||g.passive)}</p></div><div class="detail-section"><h4>${esc(g.skillName||"고유 필살기")}</h4><p>${esc(g.skillDesc||g.ultimate)}</p></div><div class="detail-section"><h4>${esc(g.weaknessName||"전투 약점")}</h4><p>${esc(g.weaknessDesc||g.weakness)}</p></div><div class="detail-section"><p class="muted">※ 능력치는 게임 밸런스를 위한 창작 설계값입니다.</p></div>`;$("#general-dialog").showModal()}
function switchTab(t){document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(`#${t}-view`).classList.remove("hidden");document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===t))}
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
function renderSetup(){const selected=battle?.selectedIds||[];$("#battle-roster").innerHTML=gameState.generals.filter(g=>g.owned).map(g=>`<label class="roster-choice ${selected.includes(g.id)?"selected":""}"><input type="checkbox" data-pick="${esc(g.id)}" ${selected.includes(g.id)?"checked":""} ${battle?.active?"disabled":""}><span class="choice-name">${esc(g.name)}</span><span class="choice-style">${esc(g.style)}</span><span class="choice-rank">${esc(g.rank)}</span></label>`).join("");$("#battle-owned-count").textContent=gameState.generals.filter(g=>g.owned).length;$("#start-battle").disabled=selected.length!==3||!!battle?.active}
// [v0.3.1 수정] AI도 플레이어와 같은 규칙으로 3명만 출전합니다. (기존: 내가 고르지 않은 47명 전체에서 매 라운드 최강자를 선택)
function pickEnemyTeam(excludeIds){const pool=gameState.generals.filter(g=>!excludeIds.includes(g.id)).map(g=>g.id);for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool.slice(0,3)}
function startBattle(){const ids=[...(battle?.selectedIds||[])];if(ids.length!==3)return notify("출전 장수 3명을 선택해주세요.");battle={selectedIds:ids,available:[...ids],enemyPool:pickEnemyTeam(ids),pw:0,ew:0,round:1,active:true,used:[],skillUsed:[]};$("#battle-setup").classList.add("hidden");$("#battle-arena").classList.remove("hidden");$("#next-battle").classList.add("hidden");$("#player-score").textContent="0";$("#enemy-score").textContent="0";$("#round-label").textContent="1라운드";$("#ultimate-toggle").checked=false;$("#ultimate-toggle").disabled=false;$("#ultimate-hint").textContent="각 장수는 한 번만 출전하므로, 출전할 때마다 필살기 사용 여부를 고를 수 있습니다.";$("#player-card").textContent="출전 장수를 선택하세요.";$("#enemy-card").textContent="AI 대기 중";$("#round-result").textContent="이번 라운드에 출전할 장수를 선택하세요.";renderChoices();renderSetup()}
function beats(a,b){return (a==="공격형"&&b==="전술형")||(a==="전술형"&&b==="진형형")||(a==="진형형"&&b==="공격형")}
function power(g){return calculatePower(g)}
function passiveBonus(g){return passiveCombatBonus(g)}
function weaknessPenalty(g,opp){return weaknessCombatPenalty(g,opp)}
function skillBonus(g,opp,advantage){return ultimateCombatBonus(g,advantage)}
function renderChoices(){const a=battle.available.map(id=>gameState.generals.find(g=>g.id===id));$("#battle-choices").innerHTML=a.map(g=>`<button class="choice-btn" data-fight="${esc(g.id)}"><strong>${esc(g.name)}</strong><span>${esc(g.style)}</span></button>`).join("")||'<p class="muted">출전 가능한 장수가 없습니다.</p>'}
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
const avgPower=foes.reduce((a,f)=>a+power(f),0)/foes.length;
const aiChoice=pool.map(g=>{
 const counter=foes.reduce((a,f)=>a+styleAdv(g.style,f.style),0)/foes.length;
 const score=counter*14+power(g)*.2+(g.stats.intelligence-avgInt)*.08+Math.random()*8;
 return {g,score,counter};
}).sort((a,b)=>b.score-a.score)[0];
const e=aiChoice.g;
const aiSkill= !battle.skillUsed.includes(e.id) &&
 (aiChoice.counter<0 || power(e)<avgPower || (battle.ew<battle.pw));
battle.available=battle.available.filter(x=>x!==id);
battle.enemyPool=battle.enemyPool.filter(x=>x!==e.id);
battle.used.push(id,e.id);
if(playerSkill)battle.skillUsed.push(id);
if(aiSkill)battle.skillUsed.push(e.id);
const playerCounter=styleAdv(p.style,e.style);
const enemyCounter=styleAdv(e.style,p.style);
const pSkillBonus=playerSkill?skillBonus(p,e,playerCounter):0;
const eSkillBonus=aiSkill?skillBonus(e,p,enemyCounter):0;
const pScore=power(p)+playerCounter*11+passiveBonus(p)-weaknessPenalty(p,e)+pSkillBonus+(Math.random()*10-5);
const eScore=power(e)+enemyCounter*11+passiveBonus(e)-weaknessPenalty(e,p)+eSkillBonus+(Math.random()*10-5);
const won=pScore>=eScore;
if(won)battle.pw++;else battle.ew++;
$("#player-card").innerHTML=`<strong>${esc(p.name)}</strong><span>${esc(p.style)} · 전투력 ${Math.round(power(p))}${playerSkill?" · 필살기 발동":""}</span>`;
$("#enemy-card").innerHTML=`<strong>${esc(e.name)}</strong><span>${esc(e.style)} · 전투력 ${Math.round(power(e))}${aiSkill?" · 필살기 발동":""}</span>`;
$("#player-score").textContent=battle.pw;$("#enemy-score").textContent=battle.ew;
$("#round-label").textContent=`${battle.round}라운드 결과`;
const matchup=playerCounter>0?"상성 우위":playerCounter<0?"상성 열세":"상성 동률";
$("#round-result").innerHTML=`<strong>${won?"이번 라운드 승리":"이번 라운드 패배"}</strong><span>${matchup} · ${esc(p.name)} vs ${esc(e.name)}</span><span>${playerSkill?`${esc(p.skillName)} 발동 · `:""}${aiSkill?`AI ${esc(e.skillName)} 발동`:"AI 필살기 미사용"}</span>`;
$("#ultimate-toggle").checked=false;
if(battle.pw===2||battle.ew===2||battle.round===3){finishBattle();return;}
battle.round++;
$("#round-label").textContent=`${battle.round}라운드`;
$("#round-result").innerHTML+="<p>다음 라운드에 출전할 장수를 선택하세요.</p>";
$("#ultimate-hint").textContent="다음 장수의 필살기 사용 여부를 선택할 수 있습니다.";
renderChoices();
}
async function finishBattle(){battle.active=false;const win=battle.pw>battle.ew;gameState.records=gameState.records||{};gameState.records.duelCount=(gameState.records.duelCount||0)+1;if(win){gameState.records.battleWins=(gameState.records.battleWins||0)+1;gameState.lord.gold+=150;gameState.inventory.expManual=(gameState.inventory.expManual||0)+1;if(gameState.records.battleWins%3===0)gameState.inventory.awakeningStone=(gameState.inventory.awakeningStone||0)+1}else{gameState.records.battleLosses=(gameState.records.battleLosses||0)+1;gameState.lord.gold+=60}for(const id of (battle.selectedIds||[])){const g=gameState.generals.find(x=>x.id===id);if(g?.owned){const r=addExperience(g,win?40:20);Object.assign(g,r.general)}}await persist();renderRecords();renderTraining();$("#round-result").innerHTML=`<strong>${win?"전투 승리!":"전투 패배"}</strong><span>${win?"금화 150개 획득":"참가 보상 금화 60개 획득"}</span>`;$("#battle-choices").innerHTML="";$("#next-battle").classList.remove("hidden");notify(win?"전투에서 승리했습니다!":"전투가 종료되었습니다.")}
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
  for(const k of ["skillName","skillDesc","passiveName","passiveDesc","weaknessName","weaknessDesc","passive","ultimate","weakness"])old[k]=fresh[k];
 }
 st.lord={level:1,exp:0,gold:0,gems:0,...(st.lord&&typeof st.lord==="object"?st.lord:{})};
 st.lord.gold=Number.isFinite(st.lord.gold)?Math.max(0,Math.floor(st.lord.gold)):0;
 st.inventory=st.inventory||{};if(st.inventory.expManual==null)st.inventory.expManual=3;if(st.inventory.awakeningStone==null)st.inventory.awakeningStone=0;st.inventory.expManual=Math.max(0,Math.floor(Number(st.inventory.expManual)||0));st.inventory.awakeningStone=Math.max(0,Math.floor(Number(st.inventory.awakeningStone)||0));st.settings=st.settings||{};
 st.records={battleWins:0,battleLosses:0,duelCount:0,...(st.records||{})};
 ensureRecruitState(st);
 st.saveFormatVersion=SAVE_FORMAT_VERSION;st.appDataVersion=APP_VERSION;
 return st;
}

function renderTraining(){const host=$("#training-list");if(!host)return;const owned=gameState.generals.filter(g=>g.owned);$("#training-manuals").textContent=gameState.inventory.expManual||0;$("#training-stones").textContent=gameState.inventory.awakeningStone||0;host.innerHTML=owned.map(g=>{normalizeGeneralProgress(g);const need=g.level>=30?0:expRequired(g.level);const pct=need?Math.min(100,g.exp/need*100):100;return `<article class="training-card"><div class="training-head"><div class="portrait">${esc(g.name.slice(0,1))}</div><div class="training-name"><strong>${esc(g.name)}</strong><span>${esc(g.rank)} · Lv.${g.level} · 각성 ${g.awakening}/${MAX_AWAKENING}</span></div></div><div class="training-progress"><div class="training-progress-fill" style="width:${pct}%"></div></div><p class="muted small">${g.level>=30?"최고 레벨":"경험치 "+g.exp+" / "+need}</p><div class="training-actions"><button class="secondary-btn" data-train="${esc(g.id)}" ${!gameState.inventory.expManual||g.level>=30?"disabled":""}>경험서 사용 (+${EXP_MANUAL_VALUE})</button><button class="primary-btn" data-awaken="${esc(g.id)}" ${!gameState.inventory.awakeningStone||g.awakening>=MAX_AWAKENING?"disabled":""}>각성 (${AWAKEN_STONE_COST}개)</button></div></article>`}).join("")||'<p class="muted">보유한 장수가 없습니다. 먼저 장수를 모집하세요.</p>'}
async function trainGeneral(id){const g=gameState.generals.find(x=>x.id===id);if(!g||!g.owned)return;if((gameState.inventory.expManual||0)<1)return notify("경험서가 부족합니다.");if(g.level>=30)return notify("이미 최고 레벨입니다.");const next=clone(gameState);next.inventory.expManual--;const idx=next.generals.findIndex(x=>x.id===id);const result=addExperience(next.generals[idx],EXP_MANUAL_VALUE);next.generals[idx]=result.general;await commitState(next);notify(`${g.name} 경험치 +${EXP_MANUAL_VALUE}${result.levels?` · 레벨 ${result.general.level} 달성`:""}`)}
async function awaken(id){const res=awakenGeneral(gameState,id);if(!res.ok)return notify(res.reason);await commitState(res.state);notify(`${res.general.name} 각성 ${res.general.awakening}단계 달성!`)}

async function init(){let loaded=await loadState(seedState());
if(!loaded||!Array.isArray(loaded.generals)){try{await saveRecovery(loaded)}catch(e){console.error(e)}loaded=seedState()}
gameState=normalizeState(loaded);
await persist();
recruitUI=createRecruitUI({$,esc,getState:()=>gameState,commit:commitState,notify});recruitUI.init();render();
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));$("#search").addEventListener("input",render);$("#faction-filter").addEventListener("change",render);$("#rank-filter").addEventListener("change",render);
document.addEventListener("click",e=>{const c=e.target.closest(".general-card");if(c)openGeneral(c.dataset.id);const f=e.target.closest("[data-fight]");if(f)playRound(f.dataset.fight);const t=e.target.closest("[data-train]");if(t)trainGeneral(t.dataset.train);const a=e.target.closest("[data-awaken]");if(a)awaken(a.dataset.awaken)});
$("#battle-roster").addEventListener("change",e=>{const id=e.target.dataset.pick;if(!id)return;battle=battle||{selectedIds:[],active:false};if(e.target.checked){if(battle.selectedIds.length<3)battle.selectedIds.push(id);else e.target.checked=false}else battle.selectedIds=battle.selectedIds.filter(x=>x!==id);renderSetup()});
$("#start-battle").addEventListener("click",startBattle);$("#next-battle").addEventListener("click",resetBattle);$("#close-dialog").addEventListener("click",()=>$("#general-dialog").close());$("#export-btn").addEventListener("click",exportBackup);$("#copy-backup-btn").addEventListener("click",copyBackupText);$("#paste-import-btn").addEventListener("click",importBackupText);document.querySelectorAll("[data-app-version]").forEach(e=>e.textContent=APP_VERSION);$("#import-btn").addEventListener("click",importBackup);if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(console.error)}
init().catch(e=>{console.error(e);document.body.insertAdjacentHTML("beforeend",`<p style="padding:20px;color:#ffb4a9">게임 데이터를 불러오지 못했습니다. ${esc(e.message)} 저장 데이터는 삭제되지 않았습니다.</p>`)});
