// One toaster for the shell, made on first use. Toasts are for what needs reading: a refused file, a failed call.
import { Intent, OverlayToaster, type Toaster } from '@blueprintjs/core';

let toaster: Promise<Toaster> | null = null;

export function toast(message: string, intent: Intent = Intent.DANGER): void {
  toaster ??= OverlayToaster.createAsync({ position: 'top' });
  void toaster.then((t) => t.show({ message, intent, timeout: 8000 }));
}
