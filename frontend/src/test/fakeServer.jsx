import { afterEach, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AxiosError } from 'axios';
import App from '../App';
import api from '../services/api';

/**
 * Swaps axios's network adapter for canned responses, so tests exercise the
 * real interceptors, AuthContext, guards and pages. Register handlers with
 * `server.on('GET /projects', () => [200, data])`; unknown requests throw.
 */
export function setupFakeServer() {
  const server = { routes: {}, calls: [] };
  server.on = (key, handler) => {
    server.routes[key] = handler;
  };
  server.callsTo = (key) => server.calls.filter((c) => c.key === key);

  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    server.routes = {};
    server.calls = [];
    api.defaults.adapter = async (config) => {
      const key = `${config.method.toUpperCase()} ${config.url}`;
      // JSON bodies arrive as strings; uploads arrive as FormData.
      const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      server.calls.push({ key, body, headers: config.headers });
      const handler = server.routes[key];
      if (!handler) throw new Error(`Unhandled request in test: ${key}`);
      const [status, data] = await handler(config);
      const response = { status, data, statusText: '', headers: {}, config };
      if (status >= 400) {
        throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, response);
      }
      return response;
    };
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  return server;
}

export function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
