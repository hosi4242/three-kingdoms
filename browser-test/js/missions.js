// v0.8.0 누적 임무·업적: 날짜/시간 변경으로 악용할 수 있는 일일 임무는 넣지 않습니다.
export const MISSION_DEFS = [
  {id:"first_battle_win",category:"전투",title:"첫 승전보",description:"전투에서 1회 승리하세요.",metric:"battleWins",target:1,reward:{gold:200,materials:5}},
  {id:"battle_wins_10",category:"전투",title:"연전연승",description:"누적 전투 승리 10회를 달성하세요.",metric:"battleWins",target:10,reward:{gold:500,materials:12}},
  {id:"battle_wins_30",category:"전투",title:"백전노장",description:"누적 전투 승리 30회를 달성하세요.",metric:"battleWins",target:30,reward:{gold:1200,materials:25,manuals:2}},
  {id:"campaign_clear_5",category:"전장",title:"전장의 발자취",description:"전장 스테이지 5개를 최초 승리로 완료하세요.",metric:"campaignClears",target:5,reward:{gold:600,leather:8}},
  {id:"campaign_clear_all",category:"전장",title:"천하의 길목",description:"전장 스테이지 15개를 모두 최초 승리로 완료하세요.",metric:"campaignClears",target:15,reward:{gold:2000,jade:2,manuals:3}},
  {id:"recruit_10",category:"모집",title:"인재를 찾아서",description:"장수 모집 누적 10회를 진행하세요.",metric:"recruitPulls",target:10,reward:{gold:300,materials:5}},
  {id:"recruit_50",category:"모집",title:"인재 등용",description:"장수 모집 누적 50회를 진행하세요.",metric:"recruitPulls",target:50,reward:{gold:1000,materials:15,leather:5}},
  {id:"recruit_100",category:"모집",title:"명장 집결",description:"장수 모집 누적 100회를 진행하세요.",metric:"recruitPulls",target:100,reward:{gold:1800,jade:1,manuals:2}},
  {id:"generals_10",category:"수집",title:"든든한 진용",description:"보유 장수를 10명으로 늘리세요.",metric:"ownedGenerals",target:10,reward:{gold:400,manuals:2}},
  {id:"generals_20",category:"수집",title:"인재의 요람",description:"보유 장수를 20명으로 늘리세요.",metric:"ownedGenerals",target:20,reward:{gold:900,materials:15,manuals:3}},
  {id:"generals_40",category:"수집",title:"천하의 인재",description:"보유 장수를 40명으로 늘리세요.",metric:"ownedGenerals",target:40,reward:{gold:1800,jade:1,manuals:5}},
  {id:"training_levels_30",category:"육성",title:"장수 육성",description:"보유 장수의 누적 레벨 합계 30을 달성하세요.",metric:"totalLevels",target:30,reward:{gold:500,manuals:3}},
  {id:"training_levels_60",category:"육성",title:"정예 부대",description:"보유 장수의 누적 레벨 합계 60을 달성하세요.",metric:"totalLevels",target:60,reward:{gold:1200,awakeningStones:2}},
];
export function defaultMissionState(){return {completedIds:[]};}
export function normalizeMissionState(value){const ids=new Set(MISSION_DEFS.map(x=>x.id));return {completedIds:[...new Set((Array.isArray(value?.completedIds)?value.completedIds:[]).filter(x=>ids.has(x)))]};}
export function missionMetrics(state){const records=state.records||{};return {battleWins:Math.max(0,Number(records.battleWins)||0),campaignClears:Array.isArray(state.campaign?.clearedStages)?state.campaign.clearedStages.length:0,recruitPulls:Object.values(state.recruit?.totalPulls||{}).reduce((a,b)=>a+Math.max(0,Number(b)||0),0),ownedGenerals:(state.generals||[]).filter(g=>g.owned).length,totalLevels:(state.generals||[]).filter(g=>g.owned).reduce((a,g)=>a+Math.max(1,Number(g.level)||1),0)};}
export function applyMissionProgress(state){state.missions=normalizeMissionState(state.missions);state.lord||={gold:0};state.inventory||={};const metrics=missionMetrics(state),newlyCompleted=[];for(const m of MISSION_DEFS){if(state.missions.completedIds.includes(m.id)||metrics[m.metric]<m.target)continue;state.missions.completedIds.push(m.id);const r=m.reward;state.lord.gold=(Number(state.lord.gold)||0)+(r.gold||0);state.inventory.equipmentMaterials=(Number(state.inventory.equipmentMaterials)||0)+(r.materials||0);state.inventory.equipmentLeather=(Number(state.inventory.equipmentLeather)||0)+(r.leather||0);state.inventory.equipmentJade=(Number(state.inventory.equipmentJade)||0)+(r.jade||0);state.inventory.expManual=(Number(state.inventory.expManual)||0)+(r.manuals||0);state.inventory.awakeningStone=(Number(state.inventory.awakeningStone)||0)+(r.awakeningStones||0);newlyCompleted.push(m);}return newlyCompleted;}
export function missionRewardText(reward){return Object.entries({금화:reward.gold,철광석:reward.materials,가죽:reward.leather,옥:reward.jade,경험서:reward.manuals,각성석:reward.awakeningStones}).filter(([,v])=>v).map(([k,v])=>`${k} ${v}`).join(" · ");}
