import { FocusStyleManager } from '@blueprintjs/core';
import { createRoot } from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@fontsource-variable/source-sans-3';
// The shell's one stylesheet: the faces, the frame, the few chrome paints. Every colour is Blueprint's own.
import './shell.css';
import { App } from './App';
import { settleRoute } from './shell/route';

// Focus rings for keyboard users only. Every control in the shell is a Blueprint component, so the manager covers it.
FocusStyleManager.onlyShowFocusOnTabs();
settleRoute();

const host = document.getElementById('root');
if (!host) throw new Error('missing #root');
createRoot(host).render(<App />);
