import Chart, { ChartType, Tooltip, TooltipPositionerFunction } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

declare module 'chart.js' {
  interface TooltipPositionerMap {
    fixed: TooltipPositionerFunction<ChartType>;
  }
}
Tooltip.positioners.fixed = (items, eventPosition) => ({
  x: eventPosition.x,
  y: chart?.height ?? 0,
  yAlign: 'top',
});

const fileInput: HTMLInputElement = document.getElementById('input');
const drawButton: HTMLButtonElement = document.getElementById('draw');
const resetZoomButton: HTMLButtonElement = document.getElementById('reset-zoom');
const chartCanvas: HTMLCanvasElement = document.getElementById('chart');
const combosDiv: HTMLDivElement = document.getElementById('combos');

const dataTypes = ['number', 'string'];
const scales = ['y1', 'y2', 'y3'];
let parsed: Record<string, number[]> | undefined;
let chart: Chart | undefined;

drawButton.onclick = () => {
  if (parsed)
    drawChart(parsed);
};

resetZoomButton.onclick = () => chart?.resetZoom();

fileInput.onchange = () => {
  console.debug('input.onchange', fileInput);
  const file = fileInput.files?.[0];
  if (!file)
    return;

  const reader = new FileReader();
  reader.onload = () => {
    parsed = parseCsv(reader.result);
    populateCombos(parsed);
  };
  reader.readAsText(file);
};

function parseCsv(input: string): Record<string, number[]> {
  const t1 = window.performance.now();
  let offset = 0; // Input string offset

  const end = input.indexOf('\r\n', offset);
  const headers = input.substring(offset, end).split(';');
  offset = end + 2;

  const data: number[][] = [];
  let index = 0; // Data array value index
  while (offset < input.length) {
    const end = input.indexOf('\r\n', offset);
    const split = input.substring(offset, end).split(';');
    split.forEach((v, i) => {
      data[i] ??= [];
      data[i][index] = Number(v);
    });
    offset = end + 2;
    index++;
  }

  const result = Object.fromEntries(headers.map((h, i) => [h, data[i]]));
  console.log('result', result);

  const t2 = window.performance.now();
  console.log('Parsing CSV took', t2 - t1, 'ms');

  return result;
}

function populateCombos(input: Record<string, number[]>) {
  combosDiv.innerHTML = '';
  for (const key of Object.keys(input)) {
    const text = document.createTextNode(key + ' ');

    // const selectType = document.createElement('select');
    // for (const type of dataTypes) {
    //   const option = document.createElement('option');
    //   option.innerText = type;
    //   option.value = type;
    //   selectType.append(option);
    // }

    const selectScale = document.createElement('select');
    selectScale.classList.add('select-scale');
    for (const scale of scales) {
      const option = document.createElement('option');
      option.innerText = scale;
      option.value = scale;
      selectScale.append(option);
    }

    const div = document.createElement('div');
    div.setAttribute('data-header', key);
    div.append(text, /* selectType, */ selectScale);
    combosDiv.append(div);
  }
}

function drawChart(input: Record<string, number[]>) {
  // TODO should remove time dataset from headers/scales
  const headers = Object.fromEntries([...document.getElementsByClassName('select-scale')]
    .map(e => [e.parentElement?.getAttribute('data-header'), (e as HTMLSelectElement).value]));
  console.debug('headers', headers);

  const scales = Object.fromEntries([...new Set(Object.values(headers)).values()]
    .map(y => [y, {
      type: 'linear',
      title: { display: true, text: y }
    }]));
  console.debug('scales', scales);

  const data = {
    datasets: Object.entries(input)
      .filter(([key, _]) => key !== 'time(ms)')
      .map(([key, values]) => ({
        label: key,
        data: values.map((v, i) => ({
          x: (input['time(ms)'][i] || 0) / 1000,
          y: v || 0
        })),
        yAxisID: headers[key],
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
        decimation: { enabled: true, algorithm: 'min-max' },
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
