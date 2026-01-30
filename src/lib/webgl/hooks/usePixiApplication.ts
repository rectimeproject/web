import {Container, Ticker} from "pixi.js";
import {RefObject, useEffect, useMemo, useRef} from "react";

export type PixiCallback<T> = (value: T) => void;

export default function usePixiApplication({
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
  }, [containerRef, tickCallbacks, constructCallbacks]);

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
