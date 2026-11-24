// 장수 초상화 공통 렌더러 (v1.0.1). 도감·상세·모집 결과·전투 편성·수련 화면이 모두 이 함수를 사용합니다.
// 이미지가 없거나(portrait: null) 로드에 실패하면 이름 첫 글자 대체 표시를 보여 줍니다.
const escHTML = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function portraitHTML(g, extra = "") {
  const cls = extra ? `portrait ${extra}` : "portrait";
  const initial = escHTML(String(g?.name ?? "").slice(0, 1));
  if (!g?.portrait) return `<div class="${cls}">${initial}</div>`;
  return `<img class="${cls}" src="${escHTML(g.portrait)}" alt="${escHTML(g.name)} 초상화" data-initial="${initial}" loading="lazy" decoding="async">`;
}

// error 이벤트는 버블링되지 않으므로 캡처 단계에서 한 번만 등록합니다. (화면을 다시 그려도 계속 동작)
export function installPortraitFallback(root = document) {
  root.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("portrait")) return;
    const box = document.createElement("div");
    box.className = img.className;
    box.textContent = img.dataset.initial || "";
    img.replaceWith(box);
  }, true);
}
