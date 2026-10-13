// Layer toggles + print size. No framework; the map is static inline SVG.
document.querySelectorAll('input[data-layer]').forEach(cb => cb.addEventListener('change', () => {
  document.querySelectorAll(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`).forEach(g => g.style.display = cb.checked ? '' : 'none');
}));
document.querySelectorAll('input[data-course]').forEach(cb => cb.addEventListener('change', () => {
  document.querySelectorAll(`.mainmap g.course[data-course="${cb.dataset.course}"]`).forEach(g => g.style.display = cb.checked ? '' : 'none');
}));
const paper = document.getElementById('paper');
const setPaper = v => { document.body.classList.remove('paper-tabloid', 'paper-letter'); if (v !== 'full') document.body.classList.add('paper-' + v); };
const q = new URLSearchParams(location.search).get('paper'); if (q && paper) { paper.value = q; setPaper(q); }
paper && paper.addEventListener('change', () => setPaper(paper.value));
document.getElementById('printbtn')?.addEventListener('click', () => window.print());
