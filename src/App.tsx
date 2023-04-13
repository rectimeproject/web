import { PropsWithChildren } from 'react';
import './App.css';
import NavigationBar from './NavigationBar';

function App({ children }: PropsWithChildren<{}>) {
  return (
    <>
      <NavigationBar />
      <div className="mt-3">{children}</div>
    </>
  );
}

export default App;
