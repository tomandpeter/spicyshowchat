// 动态加载页面片段（如 header/footer/roomlist）
function includeHTML() {
  document.querySelectorAll('[data-include]').forEach(async el => {
    const file = el.getAttribute('data-include');
    if (file) {
      const resp = await fetch(file);
      if (resp.ok) {
        el.innerHTML = await resp.text();
      }
    }
  });
}
window.addEventListener('DOMContentLoaded', includeHTML);
