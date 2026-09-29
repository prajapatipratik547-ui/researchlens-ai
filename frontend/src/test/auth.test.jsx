import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import api from '../services/api';
import { storage } from '../utils/storage';
import { renderAt, setupFakeServer } from './fakeServer';

const ada = { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' };

const server = setupFakeServer();
let routes;
let calls;
const respond = (status, data) => [status, data];

beforeEach(() => {
  routes = server.routes;
  calls = server.calls;
  // The dashboard loads projects once signed in.
  routes['GET /projects'] = () => respond(200, { projects: [] });
});

describe('route protection', () => {
  it('sends signed-out visitors from the dashboard to login', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('restores a stored session via /auth/me', async () => {
    storage.setToken('stored-token');
    routes['GET /auth/me'] = () => respond(200, { user: ada });
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome, ada/i })).toBeInTheDocument();
    expect(calls[0].headers.Authorization).toBe('Bearer stored-token');
  });

  it('drops an expired stored token and shows login', async () => {
    storage.setToken('expired-token');
    routes['GET /auth/me'] = () =>
      respond(401, { error: { message: 'Session expired', code: 'TOKEN_EXPIRED' } });
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(storage.getToken()).toBeNull();
  });

  it('logs the user out when any later request returns 401', async () => {
    storage.setToken('valid-token');
    routes['GET /auth/me'] = () => respond(200, { user: ada });
    routes['GET /projects'] = () => respond(401, { error: { message: 'Session expired' } });
    renderAt('/dashboard');
    await screen.findByRole('heading', { name: /welcome, ada/i });

    await api.get('/projects').catch(() => {});

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(storage.getToken()).toBeNull();
  });

  it('redirects signed-in users away from the login page', async () => {
    storage.setToken('valid-token');
    routes['GET /auth/me'] = () => respond(200, { user: ada });
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: /welcome, ada/i })).toBeInTheDocument();
  });
});

describe('login', () => {
  it('shows inline errors and does not call the API for an empty form', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(await screen.findByRole('button', { name: /^log in$/i }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls).toHaveLength(0);
  });

  it('logs in and returns to the page the user originally asked for', async () => {
    const user = userEvent.setup();
    routes['POST /auth/login'] = () => respond(200, { user: ada, token: 'new-token' });
    renderAt('/dashboard');

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'analytical1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('heading', { name: /welcome, ada/i })).toBeInTheDocument();
    expect(storage.getToken()).toBe('new-token');
    expect(server.callsTo('POST /auth/login')[0].body).toEqual({
      email: 'ada@example.com',
      password: 'analytical1',
    });
  });

  it('shows the server error for bad credentials and stays on the page', async () => {
    const user = userEvent.setup();
    routes['POST /auth/login'] = () =>
      respond(401, { error: { message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' } });
    renderAt('/login');

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(storage.getToken()).toBeNull();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeEnabled();
  });

  it('explains when the server cannot be reached', async () => {
    const user = userEvent.setup();
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
    };
    renderAt('/login');

    await user.type(await screen.findByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'analytical1');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });
});

describe('register', () => {
  it('validates password strength on the client', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'onlyletters');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Password must contain a letter and a number')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('shows a server-side duplicate email error next to the email field', async () => {
    const user = userEvent.setup();
    routes['POST /auth/register'] = () =>
      respond(409, {
        error: {
          message: 'An account with this email already exists',
          code: 'EMAIL_TAKEN',
          details: [{ field: 'email', message: 'An account with this email already exists' }],
        },
      });
    renderAt('/register');

    await user.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'analytical1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('An account with this email already exists')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates an account and lands on the dashboard', async () => {
    const user = userEvent.setup();
    routes['POST /auth/register'] = () => respond(201, { user: ada, token: 'fresh-token' });
    renderAt('/register');

    await user.type(await screen.findByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'analytical1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('heading', { name: /welcome, ada/i })).toBeInTheDocument();
    expect(storage.getToken()).toBe('fresh-token');
  });
});

describe('logout', () => {
  it('clears the session and returns to the landing page', async () => {
    const user = userEvent.setup();
    storage.setToken('valid-token');
    routes['GET /auth/me'] = () => respond(200, { user: ada });
    renderAt('/dashboard');

    await user.click(await screen.findByRole('button', { name: /log out/i }));

    await waitFor(() => expect(storage.getToken()).toBeNull());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/evidence-backed insights/i);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  });
});
