import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

const chart: HTMLCanvasElement = document.getElementById('chart');

const input: HTMLInputElement = document.getElementById('input');
input.onchange = () => {
  console.debug('input.onchange', input);
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsv(reader.result);
    drawChart(parsed);
  };
  reader.readAsText(file);
};

function parseCsv(input: string): { [key: string]: number[]; } {
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

function drawChart(input: { [key: string]: number[]; }) {
  const data = {
    datasets: Object.entries(input)
      .filter(([key, _]) => key !== 'time(ms)')
      .map(([key, values]) => ({
        label: key,
        data: values.map((v, i) => ({
          x: (input['time(ms)'][i] || 0) / 1000,
          y: v || 0
        })),
        hidden: true,
      })),
  };
  console.debug('drawChart data', data);

  new Chart(chart, {
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
        x: { type: 'linear' }
      },
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { position: 'right' },
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
