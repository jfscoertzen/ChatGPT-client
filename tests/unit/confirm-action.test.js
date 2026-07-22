const { runConfirmedAction } = require('../../src/renderer/confirm-action');

describe('confirmed renderer actions', () => {
  test('does not run destructive action when confirmation is rejected', async () => {
    const action = vi.fn();

    await expect(
      runConfirmedAction({
        confirmFn: vi.fn(() => false),
        message: 'Clear data?',
        action
      })
    ).resolves.toEqual({ confirmed: false });

    expect(action).not.toHaveBeenCalled();
  });

  test('runs destructive action only after confirmation', async () => {
    const action = vi.fn(() => Promise.resolve());
    const confirmFn = vi.fn(() => true);

    await expect(
      runConfirmedAction({
        confirmFn,
        message: 'Clear data?',
        action
      })
    ).resolves.toEqual({ confirmed: true });

    expect(confirmFn).toHaveBeenCalledWith('Clear data?');
    expect(action).toHaveBeenCalledOnce();
  });
});
