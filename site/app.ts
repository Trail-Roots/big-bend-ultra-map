// Layer toggles + print button. No framework; the map is static inline SVG.
const show = (sel: string, on: boolean) => document.querySelectorAll<SVGGElement>(sel).forEach((g) => (g.style.display = on ? '' : 'none'));
document.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.layer[data-layer="${cb.dataset.layer}"]`, cb.checked)));
document.querySelectorAll<HTMLInputElement>('input[data-course]').forEach((cb) => cb.addEventListener('change', () => show(`.mainmap g.course[data-course="${cb.dataset.course}"]`, cb.checked)));
document.getElementById('printbtn')?.addEventListener('click', () => window.print());
document.querySelectorAll<HTMLInputElement>('input[data-dist]').forEach((cb) => cb.addEventListener('change', () => document.body.classList.toggle('hide-dist', !cb.checked)));
