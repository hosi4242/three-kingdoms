// 모집 화면 (v0.4.0). 규칙 계산은 recruit.js, 저장은 app.js의 commit 함수가 담당하고 이 파일은 화면과 버튼만 다룹니다.
import { portraitHTML } from "./portrait.js";
import { BANNERS, BANNER_IDS, RANKS, PITY_LIMIT, LEGEND_REDEEM_COST, SHARD_PER_DUPLICATE, recruit, redeemLegend, recruitCost, pullsUntilGuarantee } from "./recruit.js";

export function createRecruitUI({ $, esc, getState, commit, notify }) {
  let busy = false;       // 저장이 끝나기 전 중복 터치 방지
  let selectedLegend = "";

  function bannerCard(b, st) {
    const gold = st.lord.gold, left = pullsUntilGuarantee(st, b.id);
    const odds = Object.entries(b.odds).map(([r, p]) => `<span class="odds odds-${esc(r)}">${esc(r)} ${p}%</span>`).join("");
    const pity = left === 0 ? `이번 모집에서 <strong>${esc(b.minRank)} 이상 확정</strong>` : `${left + 1}회 안에 ${esc(b.minRank)} 이상 확정 <span class="muted small">(${PITY_LIMIT}회 보장)</span>`;
    const dis = (cost) => (busy || gold < cost) ? "disabled" : "";
    return `<div class="panel settings-card banner" data-banner="${b.id}">
      <h3>${esc(b.name)}</h3><div class="odds-row">${odds}</div>
      <p class="pity">${pity}</p>
      <div class="banner-btns">
        <button class="secondary-btn" data-pull="1" data-banner="${b.id}" ${dis(b.cost.single)}>1회 · ${b.cost.single.toLocaleString()}금</button>
        <button class="primary-btn" data-pull="10" data-banner="${b.id}" ${dis(b.cost.ten)}>10회 · ${b.cost.ten.toLocaleString()}금</button>
      </div></div>`;
  }

  function resultCard(r, st) {
    const g = st.generals.find(x => x.id === r.generalId); if (!g) return "";
    const tag = r.isNew ? '<span class="tag tag-new">NEW</span>' : `<span class="tag tag-dup">중복 · ${esc(r.rank)} 혼 조각 +${r.shards}</span>`;
    return `<div class="result-card rank-${esc(r.rank)}">${portraitHTML(g)}<div><strong>${esc(g.name)}</strong><span class="rank">${esc(r.rank)}</span>${r.guaranteed ? '<span class="tag tag-pity">보장</span>' : ""}<div class="meta">${esc(g.faction)} · ${esc(g.style)}</div>${tag}</div><button type="button" class="general-back-toggle" data-general-back>뒷면 보기</button><div class="general-card-back"><b>능력치</b><p>무력 ${g.stats.martial} · 지력 ${g.stats.intelligence} · 통솔 ${g.stats.leadership} · 정치 ${g.stats.politics} · 매력 ${g.stats.charm}</p><b>필살기 효과</b><p>${esc(g.skillDesc||g.ultimate||"정보 없음")}</p></div></div>`;
  }

  function render() {
    const st = getState(); if (!st?.recruit) return;
    $("#recruit-gold").textContent = st.lord.gold.toLocaleString();
    $("#shard-list").innerHTML = RANKS.map(r => `<div class="shard rank-${esc(r)}"><span>${esc(r)}</span><strong>${st.shards[r].toLocaleString()}</strong></div>`).join("");
    $("#banner-list").innerHTML = BANNER_IDS.map(id => bannerCard(BANNERS[id], st)).join("");
    $("#recruit-results").innerHTML = st.recruit.lastResults.length ? st.recruit.lastResults.map(r => resultCard(r, st)).join("") : '<p class="muted">아직 모집 결과가 없습니다.</p>';
    // 전설 영입
    const targets = st.generals.filter(g => g.rank === "전설" && !g.owned);
    if (!targets.some(g => g.id === selectedLegend)) selectedLegend = targets[0]?.id || "";
    const have = st.shards.전설, can = have >= LEGEND_REDEEM_COST && !!selectedLegend && !busy;
    $("#redeem-progress").textContent = `${have.toLocaleString()} / ${LEGEND_REDEEM_COST}`;
    $("#redeem-bar").style.width = Math.min(100, have / LEGEND_REDEEM_COST * 100) + "%";
    $("#redeem-select").innerHTML = targets.map(g => `<option value="${esc(g.id)}" ${g.id === selectedLegend ? "selected" : ""}>${esc(g.name)} (${esc(g.faction)} · ${esc(g.style)})</option>`).join("");
    $("#redeem-select").disabled = !targets.length;
    $("#redeem-btn").disabled = !can;
    $("#redeem-note").textContent = !targets.length ? "모든 전설 장수를 이미 보유하고 있습니다." : have < LEGEND_REDEEM_COST ? `전설 혼 조각 ${LEGEND_REDEEM_COST}개가 모이면 미보유 전설 장수를 골라 영입할 수 있습니다. (중복 전설 1명당 +${SHARD_PER_DUPLICATE.전설})` : "영입할 전설 장수를 선택하세요.";
  }

  async function doPull(bannerId, count) {
    if (busy) return; busy = true; render();
    try {
      const st = getState(), res = recruit(st, bannerId, count);
      if (!res.ok) return notify(res.reason);
      await commit(res.state);                         // 저장 성공 후에만 화면/상태에 반영 (실패 시 금화·장수 그대로)
      const top = res.results.reduce((a, r) => Math.max(a, RANKS.indexOf(r.rank)), 0);
      notify(`${BANNERS[bannerId].name} ${count}회 완료 · 최고 등급 ${RANKS[top]}`);
      $("#recruit-results").scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    } catch (e) { console.error(e); notify("저장에 실패하여 모집을 취소했습니다. 금화는 차감되지 않았습니다."); }
    finally { busy = false; render(); }
  }
  async function doRedeem() {
    if (busy || !selectedLegend) return; busy = true; render();
    try {
      const res = redeemLegend(getState(), selectedLegend);
      if (!res.ok) return notify(res.reason);
      const g = res.state.generals.find(x => x.id === selectedLegend);
      await commit(res.state); notify(`${g.name} 영입 완료!`);
    } catch (e) { console.error(e); notify("저장에 실패하여 영입을 취소했습니다. 혼 조각은 차감되지 않았습니다."); }
    finally { busy = false; render(); }
  }

  function init() {
    $("#banner-list").addEventListener("click", e => { const b = e.target.closest("[data-pull]"); if (b && !b.disabled) doPull(b.dataset.banner, Number(b.dataset.pull)); });
    $("#redeem-select").addEventListener("change", e => { selectedLegend = e.target.value; render(); });
    $("#redeem-btn").addEventListener("click", doRedeem);
    render();
  }
  return { init, render };
}
