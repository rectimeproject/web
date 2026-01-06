import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useState
} from "react";
import "./App.css";
import NavigationBar from "./NavigationBar";
import useTheme from "./useTheme";

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
      <div>
        <NavigationBar />
        <div className="mt-3">{children}</div>
      </div>
    </DeviceDimensionsContext.Provider>
  );
}

export default App;
