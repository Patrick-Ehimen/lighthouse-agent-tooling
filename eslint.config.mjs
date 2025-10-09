// Root ESLint flat config that reuses shared config from tools/eslint-config
import { config as baseConfig } from "./tools/eslint-config/base.js";

export default [...baseConfig];
