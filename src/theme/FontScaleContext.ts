import { createContext } from 'react';

// Text must be remeasured when Android changes its system font scale.
export const FontScaleContext = createContext(1);
