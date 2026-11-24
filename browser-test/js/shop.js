// v0.9.0 상점: 현금 결제 없이 게임 내 금화만 사용하는 반복 구매 상점입니다.
export const SHOP_ITEMS = [
  {id:"expManual",name:"장수 경험서",description:"장수 육성에 사용하는 경험서 1개",price:180,currency:"gold",amount:1,inventoryKey:"expManual"},
  {id:"awakeningStone",name:"각성석",description:"장수 각성에 사용하는 각성석 1개",price:750,currency:"gold",amount:1,inventoryKey:"awakeningStone"},
  {id:"equipmentMaterials",name:"철광석 묶음",description:"장비 제작·강화용 철광석 5개",price:120,currency:"gold",amount:5,inventoryKey:"equipmentMaterials"},
  {id:"equipmentLeather",name:"가죽 묶음",description:"장비 제작용 가죽 3개",price:210,currency:"gold",amount:3,inventoryKey:"equipmentLeather"},
  {id:"equipmentJade",name:"옥",description:"고급 장비 제작에 필요한 옥 1개",price:900,currency:"gold",amount:1,inventoryKey:"equipmentJade"}
];
export function defaultShopState(){return {purchaseCount:0,totalGoldSpent:0};}
export function normalizeShopState(value){return {purchaseCount:Math.max(0,Math.floor(Number(value?.purchaseCount)||0)),totalGoldSpent:Math.max(0,Math.floor(Number(value?.totalGoldSpent)||0))};}
export function purchaseShopItem(state,itemId,quantity=1){
  const item=SHOP_ITEMS.find(x=>x.id===itemId);
  if(!item)return {ok:false,reason:"상점 상품을 찾을 수 없습니다."};
  if(!Number.isInteger(quantity)||quantity<1||quantity>99)return {ok:false,reason:"구매 수량은 1~99개로 선택해주세요."};
  const price=item.price*quantity;
  if(!Number.isSafeInteger(price))return {ok:false,reason:"구매 금액이 올바르지 않습니다."};
  const gold=Math.max(0,Math.floor(Number(state?.lord?.gold)||0));
  if(gold<price)return {ok:false,reason:`금화가 부족합니다. 필요 금화 ${price.toLocaleString()}개`};
  const next=JSON.parse(JSON.stringify(state));
  next.lord.gold=gold-price; next.inventory=next.inventory||{};
  next.inventory[item.inventoryKey]=Math.max(0,Math.floor(Number(next.inventory[item.inventoryKey])||0))+item.amount*quantity;
  next.shop=normalizeShopState(next.shop); next.shop.purchaseCount+=quantity; next.shop.totalGoldSpent+=price;
  return {ok:true,state:next,item,quantity,price};
}
