import { CookiePkceStateStore } from './oauth-cookie-state.store';

describe('CookiePkceStateStore', () => {
  const secret = 'test-secret';
  const verifier = 'pkce-verifier';

  function start() {
    let cookie = '';
    let state = '';
    const store = new CookiePkceStateStore(secret, false);
    store.store(
      { res: { cookie: (_name, value) => (cookie = value), clearCookie: jest.fn() } },
      verifier,
      null,
      null,
      (_error, createdState) => (state = createdState ?? ''),
    );
    return { store, cookie, state };
  }

  it('returns the PKCE verifier once only for the matching state', () => {
    const { store, cookie, state } = start();
    const clearCookie = jest.fn();
    const callback = jest.fn();
    store.verify(
      { headers: { cookie: `healthcare_oauth_pkce=${cookie}` }, res: { cookie: jest.fn(), clearCookie } },
      state,
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, verifier);
    expect(clearCookie).toHaveBeenCalled();

    const replay = jest.fn();
    store.verify(
      { headers: {}, res: { cookie: jest.fn(), clearCookie: jest.fn() } },
      state,
      replay,
    );
    expect(replay).toHaveBeenCalledWith(null, false);
  });

  it('rejects a state mismatch without exposing the verifier', () => {
    const { store, cookie } = start();
    const callback = jest.fn();
    store.verify(
      { headers: { cookie: `healthcare_oauth_pkce=${cookie}` }, res: { cookie: jest.fn(), clearCookie: jest.fn() } },
      'wrong-state',
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
