// The Assistant (S6). A stub from the wiring until Builder 4 builds it.
import { findView } from '../shell/nav';
import { Placeholder } from '../shell/Placeholder';

export function Assistant(_props: { investigation: string }) {
  return <Placeholder view={findView('assistant')!} />;
}
