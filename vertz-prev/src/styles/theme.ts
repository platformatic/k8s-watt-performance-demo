import { configureTheme } from '@vertz/theme-shadcn';
import { registerTheme } from '@vertz/ui';

const config = configureTheme({
  palette: 'slate',
  radius: 'md',
});

registerTheme(config);

export const appTheme = config.theme;
export const themeGlobals = config.globals;
