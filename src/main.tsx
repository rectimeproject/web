import "webrtc-adapter";
import "./index.scss";
import "./styles/global.css";
import "@material-design-icons/font/index.css";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import reportWebVitals from "./reportWebVitals.js";
import {StrictMode, Suspense, lazy} from "react";
import {RecorderContext, IRecorderContextValue} from "./RecorderContext.js";
import {Opus} from "./Recorder.js";
import {AudioContext} from "standardized-audio-context";
import RecorderWithDatabase from "./RecorderWithDatabase.js";
import RecorderDatabase from "./RecorderDatabase.js";
import RecorderDatabaseContext from "./RecorderDatabaseContext.js";
import {BrowserRouter, Route, Routes} from "react-router-dom";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {SpeedInsights} from "@vercel/speed-insights/react";
import ActivityIndicator from "./ActivityIndicator.js";
import workletHref from "opus-codec-worker/worklet/worklet?url";

const ReactQueryDevtools = lazy(async () => ({
  default: (await import("@tanstack/react-query-devtools")).ReactQueryDevtools
}));
// Lazy load route components
const RecordingDetailScreen = lazy(
  async () => import("./RecordingDetailScreen.js")
);
const RecordScreen = lazy(() => import("./RecordScreen.js"));
const RecordingListScreen = lazy(() => import("./RecordingListScreen.js"));
async function render() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes - recordings don't change frequently
        gcTime: 1000 * 60 * 30, // 30 minutes cache time
        retry: 1, // Single retry for IndexedDB queries
        refetchOnWindowFocus: false // Don't refetch on focus (could interrupt recording)
      },
      mutations: {
        retry: 0 // Don't retry mutations automatically
      }
    }
  });

  const el = document.getElementById("root");
  if (!el) {
    console.error("failed to find root element");
    throw new Error("Root element not found");
  }
  const root = ReactDOM.createRoot(el);

  const opus = new Opus();
  const audioContext = new AudioContext({
    sampleRate: 48000
  });
  const pendingWorklet = audioContext.audioWorklet?.addModule(workletHref);
  const recorderContext: IRecorderContextValue = {
    opus,
    recorder: pendingWorklet
      ? Promise.all([pendingWorklet, opus.initialize()]).then(
          () => new RecorderWithDatabase(audioContext, opus)
        )
      : Promise.resolve(null),
    audioContext,
    worklet: Promise.resolve<void>(pendingWorklet)
  };

  const recorderDatabase = new RecorderDatabase(
    RecorderWithDatabase.databaseName
  );

  root.render(
    <StrictMode>
      <SpeedInsights />
      <QueryClientProvider client={queryClient}>
        <ReactQueryDevtools initialIsOpen={false} />
        <RecorderDatabaseContext.Provider value={recorderDatabase}>
          <RecorderContext.Provider value={recorderContext}>
            <BrowserRouter>
              <App>
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center min-h-screen">
                      <ActivityIndicator />
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/">
                      <Route
                        path="recording/:recordingId"
                        Component={RecordingDetailScreen}
                      />
                      <Route
                        index
                        Component={RecordScreen}
                      />
                      <Route
                        path="recordings"
                        Component={RecordingListScreen}
                      />
                    </Route>
                  </Routes>
                </Suspense>
              </App>
            </BrowserRouter>
          </RecorderContext.Provider>
        </RecorderDatabaseContext.Provider>
      </QueryClientProvider>
    </StrictMode>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  render().catch(err => {
    console.error("failed to render application", err);
  });
});

reportWebVitals();
