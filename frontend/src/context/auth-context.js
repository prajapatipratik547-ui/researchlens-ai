import { createContext } from 'react';

// Kept apart from AuthProvider so AuthContext.jsx exports only components,
// which React Fast Refresh needs to hot-reload it.
export const AuthContext = createContext(null);
