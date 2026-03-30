import { jsx as _jsx } from "react/jsx-runtime";
// FILE: client/src/main.tsx
// PURPOSE: React entry point — mounts App to DOM
// USED BY: index.html
// EXPORTS: none (side effect: renders to #root)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
