import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useState
} from "react";
import "./App.css";
import NavigationBar from "./NavigationBar.js";
import useTheme from "./useTheme.js";

export interface IDeviceDimensions {
  width: number;
  height: number;
}

export const DeviceDimensionsContext = createContext<IDeviceDimensions | null>(
  null
);

function App({children}: PropsWithChildren<{}>) {
  // Initialize theme (sets data-theme attribute on document root)
  useTheme();

  const [dimensions, setDimensions] = useState<IDeviceDimensions>({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const onResize = useCallback(() => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    });
  }, []);
  useEffect(() => {
    window.addEventListener("resize", onResize, {
      passive: true
    });
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [onResize]);
  return (
    <DeviceDimensionsContext.Provider value={dimensions}>
      <div className="min-h-screen flex flex-col bg-white dark:bg-black transition-colors duration-300">
        <NavigationBar />
        <main className="flex-1">{children}</main>
      </div>
    </DeviceDimensionsContext.Provider>
  );
}

export default App;
