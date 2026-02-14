import { GlobalRegistrator } from '@happy-dom/global-registrator';
if (!globalThis.document) {
  GlobalRegistrator.register();
}
import '@testing-library/jest-dom';
