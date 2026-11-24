// 오프라인 PvE 전장 데이터와 진행도/보상 규칙
export const CAMPAIGN_CHAPTERS = [
  { id:"yellow-turban", name:"황건 잔당 토벌", subtitle:"기주의 반란군을 진압하라", faction:"군웅", stages:[
    ["탁현의 봉기", "황건 잔당의 선봉을 격파한다"], ["광종의 진격", "반란군의 보급로를 끊는다"], ["거록의 포위", "황건군의 주력을 무너뜨린다"], ["관군의 반격", "잔당의 지휘부를 추격한다"], ["황건 최후의 진", "장각의 잔당을 섬멸한다"] ]},
  { id:"warlords", name:"군웅 정벌", subtitle:"천하의 패권을 두고 맞서다", faction:"위", stages:[
    ["연주의 격돌", "연주를 둘러싼 군웅을 제압한다"], ["하북의 대치", "강력한 군웅 세력을 돌파한다"], ["강동의 도전", "수전과 기습에 대비한다"], ["서주의 공방", "요충지를 지키는 군대를 격파한다"], ["군웅의 종막", "패권을 노리는 최강의 진영과 맞선다"] ]},
  { id:"guandu", name:"관도 전투 전초전", subtitle:"관도에서 벌어질 결전을 준비하라", faction:"촉", stages:[
    ["백마의 전초전", "적의 선봉을 물리친다"], ["연진의 추격", "기동 부대를 격파한다"], ["오소 보급로", "보급을 노리는 적을 차단한다"], ["관도의 격전", "주력 부대와 정면으로 맞선다"], ["결전의 서막", "관도 결전 직전의 최종 방어선을 돌파한다"] ]}
];
export const CAMPAIGN_STAGE_COUNT = CAMPAIGN_CHAPTERS.reduce((n,c)=>n+c.stages.length,0);
export function defaultCampaignState(){return {unlockedStage:1,clearedStages:[]}}
export function normalizeCampaignState(value){
  const source=value&&typeof value==="object"?value:{};
  const cleared=[...new Set((Array.isArray(source.clearedStages)?source.clearedStages:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=CAMPAIGN_STAGE_COUNT))].sort((a,b)=>a-b);
  // 잠금 해제는 1번부터 연속으로 최초 승리한 구간까지만 인정합니다.
  let sequentialUnlock=1;
  while(sequentialUnlock<=CAMPAIGN_STAGE_COUNT&&cleared.includes(sequentialUnlock))sequentialUnlock++;
  return {unlockedStage:Math.min(CAMPAIGN_STAGE_COUNT,Math.max(1,sequentialUnlock)),clearedStages:cleared};
}
export function getCampaignStage(stageNo){
  if(!Number.isInteger(stageNo)||stageNo<1||stageNo>CAMPAIGN_STAGE_COUNT)return null;
  const chapterIndex=Math.floor((stageNo-1)/5), local=(stageNo-1)%5, chapter=CAMPAIGN_CHAPTERS[chapterIndex];
  return {number:stageNo,chapterIndex,chapterId:chapter.id,chapterName:chapter.name,name:chapter.stages[local][0],description:chapter.stages[local][1],enemyFaction:chapter.faction,scale:0.94+stageNo*0.035+chapterIndex*0.035,
    repeat:{gold:90+stageNo*12,materials:1+Math.floor((stageNo-1)/4),leather:stageNo>=6?1:0,jade:stageNo>=11?1:0},
    first:{gold:180+stageNo*25,materials:4+Math.floor(stageNo/3),leather:stageNo>=4?2:1,jade:stageNo>=9?1:0,expManual:1}};
}
export function applyCampaignVictory(state,stageNo){
  const campaign=normalizeCampaignState(state.campaign);
  if(stageNo>campaign.unlockedStage||!getCampaignStage(stageNo))return {ok:false,reason:"아직 도전할 수 없는 전장입니다."};
  const stage=getCampaignStage(stageNo),firstClear=!campaign.clearedStages.includes(stageNo),reward=firstClear?stage.first:stage.repeat;
  state.campaign=campaign;
  campaign.clearedStages.push(...(firstClear?[stageNo]:[]));
  campaign.clearedStages.sort((a,b)=>a-b);
  campaign.unlockedStage=Math.min(CAMPAIGN_STAGE_COUNT,Math.max(campaign.unlockedStage,stageNo+1));
  state.lord.gold=(state.lord.gold||0)+reward.gold;
  state.inventory.equipmentMaterials=(state.inventory.equipmentMaterials||0)+reward.materials;
  state.inventory.equipmentLeather=(state.inventory.equipmentLeather||0)+reward.leather;
  state.inventory.equipmentJade=(state.inventory.equipmentJade||0)+reward.jade;
  state.inventory.expManual=(state.inventory.expManual||0)+reward.expManual;
  return {ok:true,firstClear,reward,stage,campaign};
}
export function buildCampaignEnemyTeam(generals,faction,stageNo,excludeIds=[]){
  const candidates=generals.filter(g=>g.faction===faction&&!excludeIds.includes(g.id));
  const score=g=>Object.values(g.stats||{}).reduce((a,b)=>a+Number(b||0),0)+(g.level||1)*2+(g.awakening||0)*3;
  const sorted=[...candidates].sort((a,b)=>score(b)-score(a));
  const offset=(stageNo-1)%Math.max(1,sorted.length);
  const rotated=[...sorted.slice(offset),...sorted.slice(0,offset)];
  return rotated.slice(0,3).map(g=>g.id);
}
