import { init2dAnimationJS, renderAnimationJS } from './render2dAnimationJS';
// @ts-ignore
import Worker from './renderJS.worker';

const canvas = document.getElementById('2dcanvas-js') as HTMLCanvasElement;
const fpsCounter = document.getElementById('2dcanvasfps-js') as HTMLSpanElement;

const ctx = canvas.getContext('2d', {
  alpha: false,
  antialias: false,
  depth: false,
}) as CanvasRenderingContext2D;

function wait(time: number) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

let imageData: ImageData;
let buf: ArrayBuffer;
let buf8: Uint8ClampedArray;

const workers: { frameStatus: boolean; worker: any }[] = [];

export async function render2dJSPerformanceTest(
  resolution = 600,
  runs = 4,
  frames = 500,
) {
  await wait(2000);
  imageData = ctx.getImageData(0, 0, resolution, resolution);
  buf = new SharedArrayBuffer(imageData.data.length);
  console.log('---------render2dJSPerformanceTest START -----------');
  for (let i = 0; i < runs; i++) {
    init2dAnimationJS({
      width: resolution,
      height: resolution,
      sharedBuffer: buf as SharedArrayBuffer,
      offset: 0,
      length: resolution,
    });
    const t0 = performance.now();
    for (let j = 0; j < frames; j++) {
      renderAnimationJS(j * 1000);
    }
    const t1 = performance.now();
    console.log(
      `JS render2d ${resolution}x${resolution}, ${frames} frames, run ${i}, time: ${(
        t1 - t0
      ).toFixed(0)} ms, fps: ${((1000 * frames) / (t1 - t0)).toFixed(2)}`,
    );
    await wait(1000);
  }
  console.log('---------render2dJSPerformanceTest END -------------');
}

export function render2dJS(threads = 1, cssanimate = false) {
  (document.getElementById(
    '2dcanvas-js-container',
  ) as HTMLElement).style.display = 'flex';

  if (cssanimate) {
    canvas.classList.add('animate');
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width;
  canvas.height = height;

  imageData = ctx.getImageData(0, 0, width, height);
  buf = new SharedArrayBuffer(imageData.data.length);
  buf8 = new Uint8ClampedArray(buf);
  let offset = 0;
  for (let i = 0; i < threads; i++) {
    const w = new Worker();
    let increment = Math.floor(width / threads);
    if (i < width % threads) {
      increment++;
    }
    w.postMessage({
      type: 'init',
      payload: {
        width,
        height,
        sharedBuffer: buf,
        offset,
        length: increment,
      },
    });
    offset += increment;

    (idx => {
      w.onmessage = function(event: any) {
        if (event.data.type === 'frameready') {
          workers[idx].frameStatus = true;
          window.requestAnimationFrame(render2dJSActual);
        }
      };
    })(i);

    workers.push({
      frameStatus: true,
      worker: w,
    });
  }
  window.requestAnimationFrame(render2dJSActual);
}

let lastCalledTime = performance.now();
let count = 0;

function render2dJSActual(timestamp: number) {
  if (!workers.reduce((acc, curr) => acc && curr.frameStatus, true)) {
    // not all workers finished rendering their part of the frame yet
    return;
  }
  const now = performance.now();
  const delta = (now - lastCalledTime) / 1000;
  lastCalledTime = now;
  if (count === 10) {
    count = 0;
    fpsCounter.innerText = (1 / delta).toFixed(2);
  } else {
    count++;
  }
  imageData.data.set(buf8);
  ctx.putImageData(imageData, 0, 0);
  workers.forEach(w => {
    w.frameStatus = false;
    w.worker.postMessage({ type: 'renderframe', payload: { timestamp } });
  });
}
