import { BlueprintProvider } from '@blueprintjs/core';
import { Home } from './home/Home';

// Blueprint's providers around everything (overlays, hotkeys, portals), as Blueprint v6 asks of an app.
export function App() {
  return (
    <BlueprintProvider>
      <Home />
    </BlueprintProvider>
  );
}
