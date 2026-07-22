(function exposeConfirmAction(root) {
  async function runConfirmedAction({ confirmFn, message, action }) {
    if (!confirmFn(message)) {
      return { confirmed: false };
    }

    await action();
    return { confirmed: true };
  }

  const api = { runConfirmedAction };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.chatgptConfirmAction = api;
})(typeof window !== 'undefined' ? window : globalThis);
