import Chart, { ChartType, Tooltip, TooltipPositionerFunction } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

declare module 'chart.js' {
  interface TooltipPositionerMap {
    fixed: TooltipPositionerFunction<ChartType>;
  }
}
Tooltip.positioners.fixed = (items, eventPosition) => ({
  // x: eventPosition.x, y: chart?.height ?? 0, xAlign: 'left',
  x: Math.abs((chart?.width ?? 0) - 150), y: 0, xAlign: 'left'
});

type Serie<T> = { header: string, values: T[] };

const fileInput: HTMLInputElement = document.getElementById('input');
const drawButton: HTMLButtonElement = document.getElementById('draw');
const resetZoomButton: HTMLButtonElement = document.getElementById('reset-zoom');
const chartCanvas: HTMLCanvasElement = document.getElementById('chart');
const combosDiv: HTMLDivElement = document.getElementById('combos');

const dataTypes = ['number', 'string'];
const scales = ['y1', 'y2', 'y3'];
let lastSeries: Serie<number>[] | undefined;
let chart: Chart | undefined;

drawButton.onclick = () => {
  if (lastSeries)
    drawChart(lastSeries);
};

resetZoomButton.onclick = () => chart?.resetZoom();

fileInput.onchange = () => {
  console.debug('input.onchange', fileInput);
  const file = fileInput.files?.[0];
  if (!file)
    return;

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string')
      throw new Error('FileReader result is not a string');

    const parsedSeries = parseCsv(reader.result);
    lastSeries = transformData(parsedSeries);
    populateCombos(lastSeries);
  };
  reader.readAsText(file);
};

function parseCsv(input: string): Serie<unknown>[] {
  const t1 = window.performance.now();
  let offset = 0;

  const data: unknown[][] = [];
  let row = 0;
  while (offset < input.length) {
    const end = input.indexOf('\r\n', offset);
    const split = input.substring(offset, end).split(';');
    split.forEach((v, col) => {
      data[col] ??= [];
      data[col][row] = v;
    });
    offset = end + 2;
    row++;
  }

  const result = data.map(values => ({ header: String(values.shift()), values }));
  console.log('result', result);

  const t2 = window.performance.now();
  console.log('Parsing CSV took', t2 - t1, 'ms');

  return result;
}

function transformData(series: Serie<unknown>[]): Serie<number>[] {
  const seenHeaders: Record<string, number> = {};
  return series
    .map(s => ({
      header: seenHeaders[s.header] === undefined
        ? (seenHeaders[s.header] = 1, s.header)
        : s.header + ' ' + ++seenHeaders[s.header],
      values: s.values.map(v => {
        switch (s.header) {
          case 'time(ms)':
            return Number(v) / 1000;
          case 'COMP_BPV': switch (v) {
            case 'OFF': return 0; // OFF = closed = small turbo not bypassed
            case 'ON': return 100; // ON = open = small turbo bypassed
            default: return -1;
          }
          case 'M_GEAR': switch (v) {
            case 'Neutral': return 0;
            case '1st gear': return 1;
            case '2nd gear': return 2;
            case '3rd gear': return 3;
            case '4th gear': return 4;
            case '5th gear': return 5;
            case '6th gear': return 6;
            default: return -1;
          }
          case 'EGR_ERR#1(%)':
            const n = Number(v);
            return (n === 99.22) ? 0 : n; // Value is fixed at 99.22 when commanded EGR is 0
          default:
            return Number(v);
        }
      }),
    }))
    .sort((a, b) => (a.header > b.header) ? +1
      : (a.header < b.header) ? -1
        : 0);
}

function populateCombos(series: Serie<unknown>[]): void {
  combosDiv.innerHTML = '';

  const headers = series.map(s => s.header).filter(h => h !== 'time(ms)');
  for (const header of headers) {
    const check = document.createElement('input');
    check.type = 'checkbox';

    const text = document.createTextNode(' ' + header + ' ');

    // const selectType = document.createElement('select');
    // for (const type of dataTypes) {
    //   const option = document.createElement('option');
    //   option.innerText = type;
    //   option.value = type;
    //   selectType.append(option);
    // }

    const selectScale = document.createElement('select');
    for (const scale of scales) {
      const option = document.createElement('option');
      option.innerText = scale;
      option.value = scale;
      selectScale.append(option);
    }

    const div = document.createElement('div');
    div.setAttribute('data-header', header);
    div.append(check, text, /* selectType, */ selectScale);
    combosDiv.append(div);
  }
}

function drawChart(series: Serie<number>[]) {
  const combos = Object.fromEntries([...combosDiv.children].map(e => [
    e.getAttribute('data-header')!,
    {
      enabled: (e.querySelector('input[type=checkbox]') as HTMLInputElement).checked,
      scale: (e.querySelector('select') as HTMLSelectElement).value,
    }]));
  console.debug('combos', combos);

  const scales = Object.fromEntries([...new Set(Object.values(combos).map(c => c.scale)).values()]
    .map(y => [y, {
      type: 'linear',
      title: { display: true, text: y }
    }]));
  console.debug('scales', scales);

  const timeSerie = series.find(s => s.header === 'time(ms)');
  if (timeSerie === undefined)
    throw new Error("Could not find 'time(ms)' serie");

  const data = {
    datasets: series
      .filter(serie => serie.header !== 'time(ms)' && combos[serie.header].enabled)
      .map(serie => ({
        label: serie.header,
        data: serie.values.map((v, i) => ({
          x: timeSerie.values[i],
          y: v,
        })),
        yAxisID: combos[serie.header].scale,
        hidden: true,
      })),
  };
  console.debug('drawChart data', data);

  if (chart)
    chart.destroy();

  chart = new Chart(chartCanvas, {
    type: 'line',
    data,
    options: {
      maintainAspectRatio: false,
      elements: {
        point: { radius: 0 },
        line: { borderWidth: 1 }
      },
      parsing: false, // With parsing == false dataset.data must be in {x,y} format
      normalized: true,
      spanGaps: true,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'seconds' }
        },
        ...scales
      },
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { position: 'right' },
        tooltip: { position: 'fixed' },
        decimation: { enabled: true, algorithm: 'min-max', threshold: 1 },
        zoom: {
          zoom: { wheel: { enabled: true }, mode: 'x' },
          pan: { enabled: true, mode: 'x' },
          // limits: {
          //     y: { min: 'original', max: 'original' }
          // }
        }
      }
    }
  });
}
