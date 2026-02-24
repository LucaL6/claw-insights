import { GlobalRegistrator } from '@happy-dom/global-registrator';
if (!globalThis.document) { // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- may be absent in non-browser env
  GlobalRegistrator.register();
}
import '@testing-library/jest-dom';
