import { BlueprintProvider } from '@blueprintjs/core';
import { BarghestDataProvider } from './data/index.ts';
import { Shell } from './shell/Shell';

// Blueprint's providers around everything (overlays, hotkeys, portals), as Blueprint v6 asks of an app; inside them
// the data layer's provider, which owns the one connection to the engine.
export function App() {
  return (
    <BlueprintProvider>
      <BarghestDataProvider>
        <Shell />
      </BarghestDataProvider>
    </BlueprintProvider>
  );
}
