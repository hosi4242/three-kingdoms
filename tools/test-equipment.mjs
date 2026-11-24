import assert from "node:assert/strict";
import { migrateState } from "../browser-test/js/db.js";
import { EQUIPMENT_CATALOG,EQUIPMENT_SLOTS,ensureEquipmentState,craftEquipment,equipItem,unequipItem,enhanceItem,dismantleItem,totalEquipmentBonuses,MAX_ENHANCE } from "../browser-test/js/equipment.js";
const general={id:"g1",owned:true,stats:{martial:70,intelligence:70,leadership:70},equipment:{}};
let state={lord:{gold:100000},generals:[general],inventory:{equipmentMaterials:1000,equipmentLeather:1000,equipmentJade:100,equipment:[]}};ensureEquipmentState(state);
assert.equal(EQUIPMENT_SLOTS.length,5);
for(const slot of EQUIPMENT_SLOTS)assert.ok(EQUIPMENT_CATALOG.some(x=>x.slot===slot));
const recipe=EQUIPMENT_CATALOG.find(x=>x.slot==="무기"&&x.rank==="일반");let r=craftEquipment(state,recipe.id);assert.equal(r.ok,true);state=r.state;const uid=state.inventory.equipment[0].uid;
r=equipItem(state,"g1",uid);assert.equal(r.ok,true);state=r.state;assert.equal(state.generals[0].equipment["무기"],uid);
state.generals.push({id:"g2",owned:true,equipment:{}});assert.equal(equipItem(state,"g2",uid).ok,false,"동일 장비 중복 장착 금지");
assert.equal(dismantleItem(state,uid).ok,false,"장착 중 장비 분해 금지");
for(let i=0;i<MAX_ENHANCE;i++){r=enhanceItem(state,uid);assert.equal(r.ok,true);state=r.state;}
assert.equal(enhanceItem(state,uid).ok,false,"+10 상한");assert.equal(state.inventory.equipment[0].enhance,10,"장비 파괴 없이 강화");
r=unequipItem(state,"g1","무기");assert.equal(r.ok,true);state=r.state;
r=unequipItem(state,"g1","무기");assert.equal(r.ok,false);
r=dismantleItem(state,uid);assert.equal(r.ok,true);state=r.state;assert.equal(state.inventory.equipment.length,0);assert.ok(state.inventory.equipmentMaterials>0);
// 모든 장비 슬롯에서 같은 세트를 선택할 수 있는 레시피 조합이 존재하는지 확인
for(const set of ["청룡","백호","현무","주작"])for(const slot of EQUIPMENT_SLOTS)assert.ok(EQUIPMENT_CATALOG.some(x=>x.set===set&&x.slot===slot),`${set}/${slot} 세트 조합`);
// 세트 2/3/5개 효과 단계 확인
const setItems=EQUIPMENT_SLOTS.map((slot,i)=>({uid:`set-${i}`,slot,set:"청룡",stat:"martial",base:1,rank:"일반",enhance:0}));
const sg={id:"setg",owned:true,stats:{martial:50,intelligence:50,leadership:50},equipment:Object.fromEntries(EQUIPMENT_SLOTS.map((slot,i)=>[slot,setItems[i].uid]))};
let b=totalEquipmentBonuses(sg,setItems);assert.equal(b.power,22,"5세트 효과");
sg.equipment["병법서"]=null;b=totalEquipmentBonuses(sg,setItems);assert.equal(b.power,10,"4개 장착 시 3세트 효과");
sg.equipment["군마"]=null;b=totalEquipmentBonuses(sg,setItems);assert.equal(b.power,10,"3개 장착 시 3세트 효과");
sg.equipment["보물"]=null;b=totalEquipmentBonuses(sg,setItems);assert.equal(b.power,5,"2개 장착 시 2세트 효과");
// v0.5 저장 형식 3 → 최신 형식 5 마이그레이션: 기존 데이터 유지 + 새 장비 필드 추가
const old={saveFormatVersion:3,lord:{gold:777},generals:[{id:"legacy",owned:true,stats:{martial:1},level:4}],inventory:{expManual:2,awakeningStone:1}};
const migrated=migrateState(old);assert.equal(migrated.saveFormatVersion,7);assert.equal(migrated.lord.gold,777);assert.equal(migrated.generals[0].level,4);assert.equal(migrated.inventory.expManual,2);assert.equal(migrated.inventory.equipmentMaterials,30);assert.deepEqual(Object.keys(migrated.generals[0].equipment),EQUIPMENT_SLOTS);
// 재료 부족 시 제작 실패는 원본 데이터를 변경하지 않음
const poor={lord:{gold:0},generals:[general],inventory:{equipmentMaterials:0,equipmentLeather:0,equipmentJade:0,equipment:[]}};const before=JSON.stringify(poor);assert.equal(craftEquipment(poor,recipe.id).ok,false);assert.equal(JSON.stringify(poor),before);
console.log("장비 슬롯·제작·장착 제한·강화 +10·비파괴·해제·분해·세트 2/3/5 효과·저장 형식 3→7 검사 통과");
