import "./index.scss";
import "@material-design-icons/font/index.css";
import webrtcAdapter from "webrtc-adapter";
import ReactDOM from "react-dom/client";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { StrictMode } from "react";
import { RecorderContext, IRecorderContextValue } from "./RecorderContext";
import { Opus } from "./Recorder";
import { AudioContext } from "standardized-audio-context";
import RecorderWithDatabase from "./RecorderWithDatabase";
import RecorderDatabase from "./RecorderDatabase";
import RecorderDatabaseContext from "./RecorderDatabaseContext";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RecordingDetailScreen from "./RecordingDetailScreen";
import RecordScreen from "./RecordScreen";
import RecordingListScreen from "./RecordingListScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

async function render() {
  const queryClient = new QueryClient();

  console.log("webrtc adapter: %o", webrtcAdapter);

  const el = document.getElementById("root");
  if (!el) {
    console.error("failed to find root element");
    throw new Error("Root element not found");
  }
  const root = ReactDOM.createRoot(el);

  const opus = new Opus();
  const audioContext = new AudioContext({
    sampleRate: 48000,
  });
  const pendingWorklet = audioContext.audioWorklet?.addModule("/worklet.js");
  const recorderContext: IRecorderContextValue = {
    opus,
    recorder: pendingWorklet
      ? pendingWorklet.then(() => new RecorderWithDatabase(audioContext, opus))
      : Promise.resolve(null),
    audioContext,
    worklet: Promise.resolve<void>(pendingWorklet),
  };

  const recorderDatabase = new RecorderDatabase(
    RecorderWithDatabase.databaseName
  );

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RecorderDatabaseContext.Provider value={recorderDatabase}>
          <RecorderContext.Provider value={recorderContext}>
            <BrowserRouter>
              <App>
                <Routes>
                  <Route path="/">
                    <Route
                      path="recording/:recordingId"
                      Component={RecordingDetailScreen}
                    />
                    <Route index Component={RecordScreen} />
                    <Route path="recordings" Component={RecordingListScreen} />
                  </Route>
                </Routes>
              </App>
            </BrowserRouter>
          </RecorderContext.Provider>
        </RecorderDatabaseContext.Provider>
      </QueryClientProvider>
    </StrictMode>
  );
}

document.addEventListener("DOMContentLoaded", () => {
  render().catch((err) => {
    console.error("failed to render application", err);
  });
});

reportWebVitals();
