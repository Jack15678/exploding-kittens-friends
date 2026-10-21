const palette = { rose: ['#f5afb7', '#fde3e6'], mint: ['#9cd4c1', '#e4f3e9'], sky: ['#a9cedf', '#e3f1f5'], plum: ['#c5b3dc', '#eee6f7'], peach: ['#e9bd90', '#fff0d9'] };
const motifs = {
  bomb: '<circle cx="120" cy="172" r="25" fill="#5b4a56"/><path d="M127 147q-4-16 11-18" fill="none"/><path d="m142 116 1 9m6 3 8-3m-15 10 6 5" stroke="#e77283"/><circle cx="112" cy="164" r="5" fill="#fff" stroke="none"/>',
  snip: '<path d="m109 172 29-23m-28 10 26 27" fill="none"/><circle cx="103" cy="178" r="9" fill="#f8d4db"/><circle cx="102" cy="154" r="9" fill="#f8d4db"/>',
  vortex: '<path d="M138 170c3-29-42-33-43-3s45 38 45 7-32-25-31-5 21 16 19 3" fill="none"/>',
  leaf: '<path d="M96 187q-6-43 45-42 0 47-45 42Z" fill="#81bca4"/><path d="m97 187 30-29" fill="none"/>',
  bark: '<path d="M99 180q7-19 4-31l38 22-36 10Z" fill="#fff0d9"/><path d="m148 158 8-5m-6 19 9 3m-10-11 12-1" fill="none"/>',
  bolt: '<path d="m124 140-27 34h21l-6 24 32-39h-22Z" fill="#f3c56e"/>',
  target: '<circle cx="120" cy="170" r="25" fill="#fff"/><circle cx="120" cy="170" r="14" fill="#f1a5b3"/><circle cx="120" cy="170" r="4" fill="#5b4a56"/>',
  skip: '<path d="m99 148 30 22-30 22Zm36 0v44" fill="#fff"/>',
  reverse: '<path d="M95 162q23-30 48 0m-7-13 7 13-16 2M145 178q-23 30-48 0m7 13-7-13 16-2" fill="none"/>',
  nope: '<circle cx="120" cy="170" r="26" fill="#fff"/><path d="m102 152 36 36" stroke="#e77283" stroke-width="9"/>',
  shuffle: '<path d="M96 150c31 0 17 40 48 40m-9-10 9 10-13 5M96 190c31 0 17-40 48-40m-9 10 9-10-13-5" fill="none"/>',
  eye: '<path d="M88 172q32-40 64 0-32 37-64 0Z" fill="#fff"/><circle cx="120" cy="171" r="13" fill="#9bc5ba"/><circle cx="122" cy="169" r="5" fill="#5b4a56"/>',
  stars: '<path d="m119 140 8 20 20 8-20 8-8 20-8-20-20-8 20-8Z" fill="#fff0c3"/><path d="m149 137 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#fff"/>',
  down: '<path d="M113 143h14v27h14l-21 24-21-24h14Z" fill="#fff"/>',
  paw: '<ellipse cx="120" cy="179" rx="21" ry="15" fill="#fff"/><ellipse cx="97" cy="160" rx="7" ry="10" fill="#fff"/><ellipse cx="113" cy="151" rx="7" ry="10" fill="#fff"/><ellipse cx="130" cy="152" rx="7" ry="10" fill="#fff"/><ellipse cx="145" cy="163" rx="7" ry="10" fill="#fff"/>',
  bin: '<path d="m101 157 4 36h30l4-36M96 155h48m-29-10h11m-13 20v17m13-17v17" fill="#fff"/>',
  taco: '<path d="M89 178q29-57 62 0Z" fill="#91bfa3"/><path d="M89 178q32-27 62 0-6 26-31 24-25 2-31-24Z" fill="#f4cc83"/>',
  rainbow: '<path d="M90 188v-14a30 30 0 0 1 60 0v14" fill="none" stroke="#e98fa3" stroke-width="10"/><path d="M100 188v-14a20 20 0 0 1 40 0v14" fill="none" stroke="#f1cc83" stroke-width="9"/><path d="M110 188v-14a10 10 0 0 1 20 0v14" fill="none" stroke="#84bca6" stroke-width="8"/>',
  fish: '<path d="M92 169q27-31 45 0-18 31-45 0Zm45 0 16-15v30Z" fill="#a9cedf"/><circle cx="104" cy="167" r="3" fill="#5b4a56"/>',
  bow: '<path d="m120 172-28-20v39l28-19 28-20v39Z" fill="#e9a7b5"/><circle cx="120" cy="172" r="8" fill="#fff"/>',
};
export function catArt(color = 'peach', symbol = 'paw', variant = 0, chef = false) {
  const [coat, light] = palette[color] || palette.peach;
  return `<svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="cat-art"><ellipse cx="121" cy="215" rx="73" ry="9" fill="${coat}" opacity=".26"/><g stroke="#5b4a56" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M175 173q47-39 27-66-14-16-17 4 13 20-17 34" fill="${coat}"/><path d="M68 132q-17 29-8 66 5 17 28 12 33 9 62 0 28 9 32-13 9-44-19-70Z" fill="${coat}"/><path d="M70 78 63 34q28 3 42 28m64 16 9-44q-28 3-43 28" fill="${coat}"/><path d="m74 62-3-16 18 17m66 1 15-18-3 17" stroke="#e796a4"/><path d="M59 98q0-41 61-42t61 42q3 42-61 43-64 0-61-43Z" fill="${light}"/><path d="M107 57q7 10 5 19m12-19v16m12-15-3 16" stroke="${coat}" stroke-width="6"/><g class="cat-eyes">${variant % 3 === 1 ? '<path d="m85 98 8-7 8 7m38 0 8-7 8 7"/>' : '<ellipse cx="92" cy="96" rx="4" ry="6" fill="#5b4a56"/><ellipse cx="148" cy="96" rx="4" ry="6" fill="#5b4a56"/>'}</g><path d="m115 106 5 4 5-4Z" fill="#e38b9b" stroke="none"/><path d="M120 111q-5 12-12 5m12-5q5 12 12 5" stroke-width="3"/><ellipse cx="77" cy="111" rx="9" ry="5" fill="#efacb8" stroke="none"/><ellipse cx="163" cy="111" rx="9" ry="5" fill="#efacb8" stroke="none"/><path d="m56 98-13-4m13 14-15 1m143-11 13-4m-13 14 15 1" stroke-width="3"/><path d="m69 155 14 22m88-22-14 22"/><g stroke-width="3.5">${motifs[symbol] || motifs.paw}</g>${chef ? '<path d="M94 59V39q-24-3-18-22t25-8q10-18 25-3 21-12 31 5t-11 29v19Z" fill="#fffaf6"/><path d="M94 46h52"/>' : ''}</g></svg>`;
}
export function cardBack() { return `<svg viewBox="0 0 160 224" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="6" y="6" width="148" height="212" rx="17" fill="#eaa5af" stroke="#fff5f4" stroke-width="4"/><path d="M31 32q50-19 98 0v160q-50 19-98 0Z" fill="none" stroke="#f9dce1" stroke-width="2" stroke-dasharray="5 5"/><g transform="translate(21 48) scale(.49)">${catArt('rose', 'paw').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g><path d="m75 176 5-5 5 5-5 5Z" fill="#fff5f4"/></svg>`; }
export const AVATAR_COLORS = ['peach', 'plum', 'mint', 'sky', 'rose'];
