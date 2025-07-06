// 动态加载页面片段（如 header/footer/roomlist）
async function includeHTML() {
  const includeElements = Array.from(document.querySelectorAll('[data-include]'));
  // 并发加载所有片段
  await Promise.all(includeElements.map(async el => {
    const file = el.getAttribute('data-include');
    if (file) {
      const resp = await fetch(file);
      if (resp.ok) {
        el.innerHTML = await resp.text();
      }
    }
  }));
  // 全部加载完毕后派发事件
  document.dispatchEvent(new Event('includes-loaded'));
}
window.addEventListener('DOMContentLoaded', includeHTML);
