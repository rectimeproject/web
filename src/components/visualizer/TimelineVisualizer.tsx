import {Container, Graphics, Ticker} from "pixi.js";
import {RefObject, useEffect, useMemo, useRef} from "react";
import {IAnalyserNode, IAudioContext} from "standardized-audio-context";
import {TimelineGlowFilter} from "./TimelineGlowFilter.js";

import {memo} from "react";

/**
 * Calculate RMS (Root Mean Square) amplitude from PCM data
 * Returns value in range 0-1
 */
function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / buffer.length);
}

type PixiCallback<T> = (value: T) => void;

function useInitPixiApplication({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const tickCallbacks = useRef<Set<PixiCallback<Ticker>>>(new Set());
  const constructCallbacks = useRef<Set<PixiCallback<Container>>>(new Set());
  const effectCount = useRef(0);

  useEffect(() => {
    const id = effectCount.current++;
    const abortController = new AbortController();
    const containerEl = containerRef.current;
    const initializingApp = (async () => {
      const {Application} = await import("pixi.js");
      const app = new Application();

      console.log("[%d] Starting", id);

      if (!containerEl) {
        return null;
      }

      console.log("[%d] Initializing", id);

      await app.init({
        width: containerEl.clientWidth,
        height: containerEl.clientHeight,
        backgroundColor: 0x000000,
        antialias: true,
        roundPixels: true,
        eventFeatures: {
          click: true,
          move: true
        },
        useBackBuffer: true,
        hello: true,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
        preference: "webgl"
      });

      if (import.meta.env.DEV) {
        const {initDevtools} = await import("@pixi/devtools");
        await initDevtools({
          app,
          importPixi: false
        });
      }

      console.log("[%d] DevTools is ready", id);

      console.log("[%d] Initialized", id);

      if (abortController.signal.aborted) {
        console.log("[%d] Aborted", id);
        return app;
      }

      console.log(
        app.screen.width,
        app.screen.width,
        app.stage.width,
        app.stage.height
      );
      console.log("[%d] Starting", id);

      for (const cb of constructCallbacks.current) {
        cb(app.stage);
      }

      app.start();
      console.log("[%d] Started", id);

      app.ticker.add(() => {
        for (const cb of tickCallbacks.current) {
          cb(app.ticker);
        }
      });

      containerEl.appendChild(app.canvas);

      return app;
    })();

    return () => {
      console.log("[%d] Cleaning up", id);
      abortController.abort();
      initializingApp.then(app => {
        if (app === null) {
          console.log("[%d] Application is null", id);
          return;
        }
        console.log("[%d] Destroying", id);
        app.destroy(true, {children: true});
      });
    };
  });

  const manageCallbacks = function <T>(
    callbacks: RefObject<Set<PixiCallback<T>>>
  ) {
    return (cb: PixiCallback<T>) => {
      callbacks.current.add(cb);
      return () => {
        callbacks.current.delete(cb);
      };
    };
  };

  const pixiApplicationContext = useMemo(
    () => ({
      onTick: manageCallbacks(tickCallbacks),
      onConstruct: manageCallbacks(constructCallbacks)
    }),
    []
  );

  return pixiApplicationContext;
}

export default memo(function TimelineVisualizer({
  canvasWidth,
  canvasHeight,
  analyserNodeRef,
  backgroundColor,
  barColor
}: {
  analyserNodeRef: React.RefObject<IAnalyserNode<IAudioContext> | null>;
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: number;
  barColor: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {onTick, onConstruct} = useInitPixiApplication({
    containerRef
  });

  useEffect(() => {
    const bars = new Array<Graphics>();
    let glowFilter: TimelineGlowFilter | null = null;
    let barsContainer: Container | null = null;

    const calculateBarDimensions = ({barCount}: {barCount: number}) => {
      const realBarWidth = Math.floor(canvasWidth / barCount);
      const barGap = realBarWidth * 0.4;
      const totalBarGap = Math.ceil((barCount - 1) * barGap);
      const barWidth = (canvasWidth - totalBarGap) / barCount;
      return {barCount, barWidth, barGap};
    };

    const desiredBarCount = canvasWidth * (1 / 16);
    const barCount = Math.floor(canvasWidth / (canvasWidth / desiredBarCount));
    const {barGap, barWidth} = calculateBarDimensions({
      barCount
    });
    const removeConstructCallback = onConstruct(stage => {
      stage.removeChildren();

      const container = new Container({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight
      });

      container.addChild(
        new Graphics({
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight
        })
          .rect(0, 0, canvasWidth, canvasHeight)
          .fill(backgroundColor)
      );

      // Create a separate container for the bars to apply the filter
      barsContainer = new Container({
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight
      });

      for (let i = 0; i < barCount; i++) {
        const bar = new Graphics({
          x: i * (barWidth + barGap),
          y: canvasHeight / 2
        });
        bars.push(bar);
        barsContainer.addChild(bar);
      }

      // Create and apply the glow filter to the bars container
      glowFilter = new TimelineGlowFilter({
        canvasSize: [canvasWidth, canvasHeight],
        glowIntensity: 1.2,
        glowRadius: 15.0,
        baseColor: [1.0, 0.4, 0.1], // Orange base for fire
        glowColor: [1.0, 0.2, 0.0], // Red-orange glow
        flameIntensity: 1.0
      });
      barsContainer.filters = [glowFilter];

      container.addChild(barsContainer);
      stage.addChild(container);
    });

    const amplitudeRecords = new Array<number>(barCount).fill(0);
    let recordIndex = 0;
    const MAX_COLOR = 2 ** 24 - 1;
    let timeDomainData: Float32Array | null = null;
    let elapsedTime = 0;

    const removeTickCallback = onTick(ticker => {
      const analyserNode = analyserNodeRef.current;
      if (analyserNode === null) {
        return;
      }

      if (!timeDomainData || timeDomainData.length !== analyserNode.fftSize) {
        timeDomainData = new Float32Array(analyserNode.fftSize);
      }

      analyserNode.getFloatTimeDomainData(timeDomainData);

      const rms = calculateRMS(timeDomainData);
      const currentAmplitude = Math.min(rms * 4.0, 1.0);

      {
        amplitudeRecords[recordIndex % amplitudeRecords.length] =
          currentAmplitude;
        recordIndex++;
      }

      // Update the glow filter with current amplitude and time
      if (glowFilter) {
        elapsedTime += ticker.deltaMS;
        glowFilter.update(ticker.deltaMS, currentAmplitude);
      }

      const maxBarHeight = canvasHeight * 0.8;

      for (let i = 0; i < amplitudeRecords.length; i++) {
        // const index = (i + recordIndex) % amplitudeRecords.length;
        // const reversedIndex = amplitudeRecords.length - 1 - index;
        const rms =
          amplitudeRecords[(i + recordIndex) % amplitudeRecords.length] ?? null;
        if (rms === null) {
          continue;
        }
        const bar = bars[i] ?? null;
        if (!bar) {
          continue;
        }
        const barHeight = Math.max(2, maxBarHeight * rms);
        bar
          .clear()
          .roundRect(0, -barHeight / 2, barWidth, barHeight, barWidth)
          .fill(barColor % MAX_COLOR);
      }
    });

    return () => {
      removeTickCallback();
      removeConstructCallback();
    };
  }, [
    barColor,
    onTick,
    onConstruct,
    backgroundColor,
    analyserNodeRef,
    canvasWidth,
    canvasHeight
  ]);

  const containerDimensions = useMemo(
    () => ({
      width: canvasWidth,
      height: canvasHeight
    }),
    [canvasWidth, canvasHeight]
  );

  return (
    <div
      ref={containerRef}
      style={containerDimensions}
    />
  );
});
