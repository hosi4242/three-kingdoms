// v0.6.0 장비 시스템: 장비 파괴 없는 강화, 제작/분해, 세트 효과
export const EQUIPMENT_SLOTS = ["무기","갑옷","군마","보물","병법서"];
export const EQUIPMENT_RANKS = ["일반","고급","희귀","영웅","전설"];
export const MAX_ENHANCE = 10;
export const RANK_MULTIPLIER = {"일반":1,"고급":1.25,"희귀":1.55,"영웅":1.95,"전설":2.5};
export const SETS = {
  "청룡": {name:"청룡 세트", bonuses:{2:{power:5},3:{power:10},5:{power:22}}},
  "백호": {name:"백호 세트", bonuses:{2:{martial:3},3:{martial:6,power:4},5:{martial:12,power:12}}},
  "현무": {name:"현무 세트", bonuses:{2:{leadership:3},3:{leadership:6,power:4},5:{leadership:12,power:12}}},
  "주작": {name:"주작 세트", bonuses:{2:{intelligence:3},3:{intelligence:6,power:4},5:{intelligence:12,power:12}}}
};
const SLOT_STATS = {"무기":"martial","갑옷":"leadership","군마":"leadership","보물":"intelligence","병법서":"intelligence"};
const SLOT_NAMES = {"무기":"철검","갑옷":"산문갑","군마":"적토마 안장","보물":"옥패","병법서":"병법 죽간"};
export function createEquipmentCatalog(){
 const out=[]; let n=0;
 for(const slot of EQUIPMENT_SLOTS) for(let r=0;r<EQUIPMENT_RANKS.length;r++){
  const rank=EQUIPMENT_RANKS[r],set=["청룡","백호","현무","주작"][(Math.floor(n/5)+r)%4];
  out.push({id:`eq-${slot}-${rank}`,name:`${set} ${SLOT_NAMES[slot]}`,slot,rank,set,stat:SLOT_STATS[slot],base:Math.round((r+1)*2.4),craftGold:100+r*150,craftMaterial:8+r*5,dismantleMaterial:4+r*3}); n++;
 }
 return out;
}
export const EQUIPMENT_CATALOG=createEquipmentCatalog();
export function ensureEquipmentState(state){
 state.inventory ||= {}; state.inventory.equipmentMaterials=Math.max(0,Math.floor(Number(state.inventory.equipmentMaterials)||0));
 state.inventory.equipmentLeather=Math.max(0,Math.floor(Number(state.inventory.equipmentLeather)||0));
 state.inventory.equipmentJade=Math.max(0,Math.floor(Number(state.inventory.equipmentJade)||0));
 if(!Array.isArray(state.inventory.equipment)) state.inventory.equipment = [];
 for(const g of state.generals||[]) {g.equipment ||= {}; for(const s of EQUIPMENT_SLOTS) if(g.equipment[s]===undefined)g.equipment[s]=null;}
 return state;
}
export function enhanceCost(item){const lv=Math.max(0,Math.min(MAX_ENHANCE,Math.floor(item?.enhance||0)));return {gold:100+lv*100,materials:2+lv};}
export function equipmentPower(item){if(!item)return 0;return item.base*RANK_MULTIPLIER[item.rank]*(1+(Math.max(0,item.enhance||0)*.12));}
export function getSetBonus(g,inventory){
 const counts={}; for(const id of Object.values(g.equipment||{})){const item=(inventory||[]).find(x=>x.uid===id);if(item?.set)counts[item.set]=(counts[item.set]||0)+1;}
 const active=[];let bonus={power:0,martial:0,leadership:0,intelligence:0};
 for(const [set,count] of Object.entries(counts)){const def=SETS[set];const tier=count>=5?5:count>=3?3:count>=2?2:0;if(!tier)continue;const b=def.bonuses[tier];active.push(`${def.name} ${tier}세트`);for(const [k,v] of Object.entries(b))bonus[k]=(bonus[k]||0)+v;}
 return {active,bonus};
}
export function totalEquipmentBonuses(g,inventory){
 let stats={martial:0,leadership:0,intelligence:0,power:0};
 for(const id of Object.values(g.equipment||{})){const item=(inventory||[]).find(x=>x.uid===id);if(item){stats[item.stat]+=equipmentPower(item);}}
 const set=getSetBonus(g,inventory);for(const [k,v] of Object.entries(set.bonus))stats[k]=(stats[k]||0)+v;
 return {...stats,sets:set.active};
}
export function craftEquipment(state,catalogId){
 const next=structuredClone(state);ensureEquipmentState(next);const def=EQUIPMENT_CATALOG.find(x=>x.id===catalogId);if(!def)return {ok:false,reason:"존재하지 않는 장비입니다."};
 if(next.lord.gold<def.craftGold||next.inventory.equipmentMaterials<def.craftMaterial)return {ok:false,reason:"제작 재료 또는 금화가 부족합니다."};
 next.lord.gold-=def.craftGold;next.inventory.equipmentMaterials-=def.craftMaterial;
 if(def.rank!=="일반"){if(next.inventory.equipmentLeather<Math.ceil(def.craftMaterial/3))return {ok:false,reason:"가죽이 부족합니다."};next.inventory.equipmentLeather-=Math.ceil(def.craftMaterial/3);}
 if(def.rank==="전설"){if(next.inventory.equipmentJade<2)return {ok:false,reason:"옥이 부족합니다."};next.inventory.equipmentJade-=2;}
 next.inventory.equipment.push({...def,uid:`${def.id}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,enhance:0});return {ok:true,state:next,item:next.inventory.equipment.at(-1)};
}
export function equipItem(state,generalId,uid){const next=structuredClone(state);ensureEquipmentState(next);const g=next.generals.find(x=>x.id===generalId),item=next.inventory.equipment.find(x=>x.uid===uid);if(!g?.owned||!item)return {ok:false,reason:"장수 또는 장비를 찾을 수 없습니다."};if(next.generals.some(x=>x.id!==generalId&&Object.values(x.equipment||{}).includes(uid)))return {ok:false,reason:"다른 장수가 이미 장착한 장비입니다."};
 const previous=g.equipment[item.slot];if(previous===uid)return {ok:false,reason:"이미 장착한 장비입니다."};g.equipment[item.slot]=uid;return {ok:true,state:next,returnedUid:previous};}
export function unequipItem(state,generalId,slot){const next=structuredClone(state);ensureEquipmentState(next);const g=next.generals.find(x=>x.id===generalId);if(!g?.owned||!EQUIPMENT_SLOTS.includes(slot)||!g.equipment[slot])return {ok:false,reason:"해제할 장비가 없습니다."};g.equipment[slot]=null;return {ok:true,state:next};}
export function enhanceItem(state,uid){const next=structuredClone(state);ensureEquipmentState(next);const item=next.inventory.equipment.find(x=>x.uid===uid);if(!item)return {ok:false,reason:"장비를 찾을 수 없습니다."};if(item.enhance>=MAX_ENHANCE)return {ok:false,reason:"최대 강화 단계입니다."};const cost=enhanceCost(item);if(next.lord.gold<cost.gold||next.inventory.equipmentMaterials<cost.materials)return {ok:false,reason:"강화 비용 또는 재료가 부족합니다."};next.lord.gold-=cost.gold;next.inventory.equipmentMaterials-=cost.materials;item.enhance++;return {ok:true,state:next,item};}
export function dismantleItem(state,uid){const next=structuredClone(state);ensureEquipmentState(next);const i=next.inventory.equipment.findIndex(x=>x.uid===uid);if(i<0)return {ok:false,reason:"장비를 찾을 수 없습니다."};if(next.generals.some(g=>Object.values(g.equipment||{}).includes(uid)))return {ok:false,reason:"장착 중인 장비는 먼저 해제해야 합니다."};const [item]=next.inventory.equipment.splice(i,1);next.inventory.equipmentMaterials+=item.dismantleMaterial; if(item.rank!=="일반")next.inventory.equipmentLeather+=Math.floor(item.dismantleMaterial/2);if(item.rank==="전설")next.inventory.equipmentJade++;return {ok:true,state:next};}
