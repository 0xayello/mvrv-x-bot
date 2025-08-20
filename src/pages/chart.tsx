import { useEffect, useRef } from 'react';
import Head from 'next/head';
import Script from 'next/script';

function decodePayload(search: string) {
  const params = new URLSearchParams(search);
  const d = params.get('d');
  if (!d) return { times: [], values: [] };
  try {
    const json = typeof window !== 'undefined' ? atob(d) : '';
    return JSON.parse(json) as { times: string[]; values: number[] };
  } catch {
    return { times: [], values: [] };
  }
}

export default function ChartPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const { times, values } = decodePayload(window.location.search);
    const canvas = canvasRef.current;
    if (!canvas || !Array.isArray(times) || !Array.isArray(values)) return;

    // @ts-ignore window.Chart is provided by CDN
    const Chart = (window as any).Chart;
    if (!Chart) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1200;
    const height = 675;
    canvas.width = width;
    canvas.height = height;

    const backgroundPlugin = {
      id: 'bg',
      beforeDraw: (chart: any) => {
        const { ctx: c, width: w, height: h } = chart;
        c.save();
        c.globalCompositeOperation = 'destination-over';
        c.fillStyle = '#e9ecef';
        c.fillRect(0, 0, w, h);
        c.restore();
      }
    };

    Chart.register(backgroundPlugin);

    const toY = (v: number) => v; // Chart handles scaling

    // Build gradients for zones - cores corrigidas
    const red = 'rgba(220,53,69,0.25)';
    const orange = 'rgba(255,102,0,0.22)';
    const yellow = 'rgba(255,193,7,0.20)';
    const green = 'rgba(40,167,69,0.25)';

    // @ts-ignore
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: times.map(() => ''),
        datasets: [
          { label: 'MVRV', data: values, borderColor: 'rgb(0,150,255)', borderWidth: 3, pointRadius: 0, tension: 0.35, order: 10 },
          { label: 'Green', data: values.map(() => 1.0), backgroundColor: green, borderColor: 'transparent', fill: 'origin', order: 1 },
          { label: 'Yellow', data: values.map(() => 3.0), backgroundColor: yellow, borderColor: 'transparent', fill: '-1', order: 2 },
          { label: 'Orange', data: values.map(() => 3.5), backgroundColor: orange, borderColor: 'transparent', fill: '-1', order: 3 },
          { label: 'Red', data: values.map(() => 4), backgroundColor: red, borderColor: 'transparent', fill: '-1', order: 4 },
        ]
      },
      options: {
        responsive: false,
        animation: false,
        scales: {
          y: {
            beginAtZero: true,
            min: 0,
            max: 4,
            grid: { color: 'rgba(0,0,0,0.1)' },
            ticks: { color: '#000', font: { weight: 'bold' } }
          },
          x: {
            grid: { display: false },
            ticks: { display: false }
          }
        },
        plugins: { legend: { display: false }, title: { display: true, text: 'Bitcoin MVRV - Últimos 180 dias', color: '#000', font: { size: 24, weight: 'bold' } } }
      }
    });

    document.title = 'ready';
  }, []);

  return (
    <>
      <Head>
        <meta name="robots" content="noindex" />
        <style>{`html,body{margin:0;background:#fff;}`}</style>
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="beforeInteractive" />
      <canvas ref={canvasRef} />
    </>
  );
}


