#!/usr/bin/env node
/**
 * Fear & Greed Index — chart preview generator
 * Usage: node gen-fng-preview.mjs
 */
import { writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fetch data
console.log('Fetching Fear & Greed data...');
const resp = await fetch('https://api.alternative.me/fng/?limit=1000&format=json');
const json = await resp.json();
const raw = json.data.reverse(); // oldest first

const times = raw.map(e => new Date(parseInt(e.timestamp) * 1000).toISOString().slice(0, 10));
const values = raw.map(e => parseInt(e.value));
const currentValue = values[values.length - 1];
const currentClass = raw[raw.length - 1].value_classification;

console.log(`Got ${values.length} points. Current: ${currentValue} (${currentClass})`);

// Chart dimensions
const width = 1200;
const height = 675;
const padding = { left: 80, right: 60, top: 80, bottom: 70 };
const chartArea = {
  left: padding.left,
  top: padding.top,
  right: width - padding.right,
  bottom: height - padding.bottom,
  width: width - padding.left - padding.right,
  height: height - padding.top - padding.bottom
};

const yMin = 0;
const yMax = 100;
const getY = (v) => chartArea.bottom - ((v - yMin) / (yMax - yMin)) * chartArea.height;
const getX = (i) => chartArea.left + (i / (values.length - 1)) * chartArea.width;

// Color based on value (gradient from red to green)
function getFngColor(v) {
  if (v <= 24) return '#ea3943'; // extreme fear — red
  if (v <= 44) return '#ea8c00'; // fear — orange
  if (v <= 55) return '#f5d100'; // neutral — yellow
  if (v <= 74) return '#93d900'; // greed — lime
  return '#16c784';              // extreme greed — green
}

// Build colored line segments
let lineSegments = '';
for (let i = 1; i < values.length; i++) {
  const x1 = getX(i - 1);
  const y1 = getY(Math.max(yMin, Math.min(yMax, values[i - 1])));
  const x2 = getX(i);
  const y2 = getY(Math.max(yMin, Math.min(yMax, values[i])));
  const color = getFngColor(values[i]);
  lineSegments += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" />`;
}

// X labels
const monthAbbr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const numLabels = 10;
const step = Math.floor(values.length / (numLabels - 1));
const xLabels = [];
for (let i = 0; i < numLabels; i++) {
  const index = (i === numLabels - 1) ? values.length - 1 : i * step;
  const date = new Date(times[index]);
  const label = `${monthAbbr[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
  xLabels.push({ x: getX(index), text: label });
}

// Y labels
const yLabels = [0, 25, 50, 75, 100];

// Dot position
const dotX = getX(values.length - 1);
const dotY = getY(Math.max(yMin, Math.min(yMax, currentValue)));
const dotColor = getFngColor(currentValue);

// Zone backgrounds (horizontal bands)
const zones = [
  { from: 0, to: 25, color: 'rgba(234,57,67,0.12)' },    // extreme fear
  { from: 25, to: 45, color: 'rgba(234,140,0,0.10)' },    // fear
  { from: 45, to: 55, color: 'rgba(245,209,0,0.08)' },    // neutral
  { from: 55, to: 75, color: 'rgba(147,217,0,0.10)' },    // greed
  { from: 75, to: 100, color: 'rgba(22,199,132,0.12)' },  // extreme greed
];

const zoneBands = zones.map(z => {
  const y1 = getY(z.to);
  const y2 = getY(z.from);
  return `<rect x="${chartArea.left}" y="${y1}" width="${chartArea.width}" height="${y2 - y1}" fill="${z.color}" />`;
}).join('');

// Zone labels (right side)
const zoneLabels = [
  { y: 12.5, text: 'Medo Extremo', color: '#ea3943' },
  { y: 35, text: 'Medo', color: '#ea8c00' },
  { y: 50, text: 'Neutro', color: '#f5d100' },
  { y: 65, text: 'Ganância', color: '#93d900' },
  { y: 87.5, text: 'Ganância Extrema', color: '#16c784' },
];

const zoneLabelsSvg = zoneLabels.map(z => {
  const y = getY(z.y);
  return `<text x="${chartArea.right - 10}" y="${y + 5}" text-anchor="end" font-family="DejaVuEmbed, sans-serif" font-weight="600" font-size="11" fill="${z.color}" opacity="0.5">${z.text}</text>`;
}).join('');

// Font
import { readFileSync } from 'fs';
const fontBuf = readFileSync(join(__dirname, 'assets', 'fonts', 'DejaVuSans.ttf'));
const fontB64 = fontBuf.toString('base64');
const fontCss = `@font-face { font-family: "DejaVuEmbed"; src: url(data:font/ttf;base64,${fontB64}) format('truetype'); font-weight: 400; font-style: normal; }`;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>${fontCss}</style>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" fill="#0d1117" />

  <!-- Title -->
  <text x="${width / 2}" y="52" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="32" fill="#e6edf3">Fear &amp; Greed Index</text>
  <text x="${width / 2}" y="72" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="400" font-size="14" fill="#6e7681">Bitcoin  ·  Fonte: alternative.me</text>

  <!-- Zone bands -->
  ${zoneBands}

  <!-- Grid Y -->
  ${yLabels.map(v => `<line x1="${chartArea.left}" y1="${getY(v)}" x2="${chartArea.right}" y2="${getY(v)}" stroke="rgba(255,255,255,0.08)" stroke-width="0.8" stroke-dasharray="4,6" />`).join('')}

  <!-- Watermark -->
  <text x="${chartArea.left + chartArea.width / 2}" y="${chartArea.top + chartArea.height / 2 + 14}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="900" font-size="62" fill="rgba(255,255,255,0.04)">@ParadigmaEdu</text>

  <!-- Zone labels -->
  ${zoneLabelsSvg}

  <!-- Line segments (colored by value) -->
  ${lineSegments}

  <!-- Current dot with glow -->
  <circle cx="${dotX}" cy="${dotY}" r="14" fill="${dotColor}22" />
  <circle cx="${dotX}" cy="${dotY}" r="5" fill="${dotColor}" filter="url(#glow)" />

  <!-- Value pill -->
  <rect x="${dotX - 50}" y="${dotY - 30}" width="42" height="22" rx="11" fill="${dotColor}" />
  <text x="${dotX - 29}" y="${dotY - 15}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="13" fill="#0d1117">${currentValue}</text>

  <!-- Y labels -->
  ${yLabels.map(v => `<text x="${chartArea.left - 14}" y="${getY(v) + 6}" text-anchor="end" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="18" fill="#8b949e">${v}</text>`).join('')}

  <!-- X labels -->
  ${xLabels.map(l => `<text x="${l.x}" y="${chartArea.bottom + 28}" text-anchor="middle" font-family="DejaVuEmbed, sans-serif" font-weight="700" font-size="16" fill="#8b949e">${l.text}</text>`).join('')}

  <!-- Border -->
  <rect x="${chartArea.left}" y="${chartArea.top}" width="${chartArea.width}" height="${chartArea.bottom - chartArea.top}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" rx="4" />
</svg>`;

// Render
const fontPath = join(__dirname, 'assets', 'fonts', 'DejaVuSans.ttf');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'original' },
  font: {
    fontFiles: [fontPath],
    loadSystemFonts: false,
    defaultFontFamily: 'DejaVuEmbed',
  },
});
const png = resvg.render().asPng();
const outPath = join(__dirname, 'test-fng-chart.png');
writeFileSync(outPath, png);
console.log(`Chart saved to ${outPath}`);
