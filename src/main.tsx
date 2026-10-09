import { createRoot } from 'react-dom/client';
import '@blueprintjs/core/lib/css/blueprint.css';
import '@fontsource-variable/source-sans-3';
// This site's own styles: the face and the layout. Every colour stays Blueprint's own (Palette: line).
import './site.css';
import { App } from './App';

const host = document.getElementById('root');
if (!host) throw new Error('missing #root');
createRoot(host).render(<App />);
