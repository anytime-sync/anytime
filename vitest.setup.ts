// Vitest setup: mock date-fns/locale for node environment tests
import { vi } from "vitest";

// Mock date-fns locale imports to avoid ESM/CJS resolution issues in node environment
vi.mock("date-fns/locale", () => ({
  enUS: {},
  zhTW: {},
  zhCN: {},
  ja: {},
  ko: {},
}));
