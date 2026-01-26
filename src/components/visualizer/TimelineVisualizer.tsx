import {Application, FillGradient, Graphics} from "pixi.js";
import {useCallback, useEffect, useRef} from "react";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";

function rms01(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const s = buffer[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / buffer.length); // already 0..1
}
export default function TimelineVisualizer({
  canvasWidth,
  canvasHeight,
  analyserNodeRef
}: {
  analyserNodeRef: React.RefObject<IAnalyserNode<IAudioContext> | null>;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const bars = useRef<Graphics[]>([]);

  const floatTimeDomainDataRef = useRef<Float32Array | null>(null);
  const counterRef = useRef(0);

  const tick = useCallback(() => {
    const app = appRef.current;
    if (!app) {
      return;
    }

    const analyserNode = analyserNodeRef.current;
    if (analyserNode === null) {
      return;
    }

    if (
      floatTimeDomainDataRef.current === null ||
      floatTimeDomainDataRef.current.length !== analyserNode.fftSize
    ) {
      floatTimeDomainDataRef.current = new Float32Array(analyserNode.fftSize);
    }

    const floatTimeDomainData = floatTimeDomainDataRef.current;
    analyserNode.getFloatTimeDomainData(floatTimeDomainData);

    const value = rms01(floatTimeDomainData);

    const child =
      bars.current[counterRef.current % bars.current.length] ?? null;

    if (child === null || !(child instanceof Graphics)) {
      return;
    }

    const barHeight = 200 * Math.random();

    counterRef.current += 1;
    child.clear();
    child.height = barHeight;
    child.fill(0xff0000);
  }, [analyserNodeRef]);

  const onApplicationReady = useCallback(
    (app: Application) => {
      const {height, width} = app.screen;

      const barWidth = 0.2;
      const barCount = Math.floor(width / (width * barWidth));

      for (let i = 0; i < barCount; i++) {
        const bar = new Graphics()
          .rect(i * (barWidth * width), 0, barWidth * width, height)
          .fill(0xff0000);
        bars.current.push(bar);
        app.stage.addChild(bar);
      }

      console.log("%d bars", barCount);
      app.ticker.add(tick);
      app.start();
    },
    [tick]
  );
  useEffect(() => {
    const app = new Application();

    // Initialize the application
    const pending = (async () => {
      await app.init({
        width: canvasWidth,
        preference: "webgl",
        height: canvasHeight,
        backgroundColor: 0x1099bb
      });

      // Append canvas to the ref element
      if (canvasContainerRef.current) {
        canvasContainerRef.current.appendChild(app.canvas);
      }

      onApplicationReady(app);

      appRef.current = app;

      return () => {
        app.ticker.remove(tick);
        app.destroy(true, true);
      };
    })();

    // Cleanup function
    return () => {
      pending.then(cleanup => {
        cleanup();
      });
    };
  }, [canvasWidth, canvasHeight, tick, onApplicationReady]); // Empty dependency array ensures this runs once

  return <div ref={canvasContainerRef} />;
}
