const DB_NAME = "cheonhap-save";
import { SAVE_FORMAT_VERSION } from "./version.js";
import { defaultRecruitState, defaultShards } from "./recruit.js";
import { normalizeGeneralProgress } from "./progression.js";
const DB_VERSION = 1;
export { SAVE_FORMAT_VERSION };

function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains("gameState")) db.createObjectStore("gameState");
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
    request.onerror=()=>reject(request.error);
  });
}
export async function loadState(seed){
  const db=await openDB();
  const state=await new Promise((resolve,reject)=>{
    const tx=db.transaction("gameState","readonly");
    const req=tx.objectStore("gameState").get("main");
    req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error);
  });
  db.close();
  if(!state) return seed;
  return migrateState(state);
}
export async function saveState(state){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("gameState","readwrite");
    tx.objectStore("gameState").put({...state,saveFormatVersion:SAVE_FORMAT_VERSION,updatedAt:new Date().toISOString()},"main");
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
// 버전별 변환 함수: MIGRATIONS[n] 은 "저장 형식 n → n+1" 변환입니다. (새 형식을 만들 때 여기에만 추가)
export const MIGRATIONS = {
  // 1 → 2 (v0.4.0): 모집 상태와 혼 조각 추가. 기존 필드는 건드리지 않습니다.
  1: st => { st.recruit = st.recruit || defaultRecruitState(); st.shards = st.shards || defaultShards(); },
  // 2 → 3 (v0.5.0): 장수 각성 필드와 육성 재화 추가
  2: st => { st.inventory = st.inventory || {}; if (st.inventory.expManual == null) st.inventory.expManual = 3; if (st.inventory.awakeningStone == null) st.inventory.awakeningStone = 0; for (const g of (st.generals || [])) normalizeGeneralProgress(g); },
};
export function migrateState(state){
  const migrated=JSON.parse(JSON.stringify(state));
  let version=Number(migrated.saveFormatVersion)||1;
  if(version>SAVE_FORMAT_VERSION) throw new Error("이 앱보다 새로운 저장 형식입니다. 앱을 최신 버전으로 업데이트해주세요.");
  while(version<SAVE_FORMAT_VERSION){
    const step=MIGRATIONS[version];
    if(!step) throw new Error(`저장 형식 ${version}에서 ${version+1}로 변환하는 코드가 없습니다.`);
    step(migrated); version+=1; migrated.saveFormatVersion=version;
  }
  migrated.saveFormatVersion=SAVE_FORMAT_VERSION;
  return migrated;
}
export async function replaceState(state){ await saveState(state); }

// 불러온 저장 데이터가 손상되어 새로 시작해야 할 때, 덮어쓰기 전에 원본을 "recovery" 키에 보관합니다.
export async function saveRecovery(rawState){
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction("gameState","readwrite");
    tx.objectStore("gameState").put({savedAt:new Date().toISOString(),raw:rawState},"recovery");
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
  db.close();
}
