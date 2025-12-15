const g_brushSizeEl = document.querySelector('#brush-size');
const g_brushSizeValueEl = document.querySelector('#brush-size-value');

g_brushSizeEl.addEventListener('input', () => {
    g_brushSizeValueEl.textContent = g_brushSizeEl.value;
});
