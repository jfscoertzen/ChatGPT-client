const params = new URLSearchParams(window.location.search);
const errorCode = params.get('errorCode') || '';
const errorDescription = params.get('errorDescription') || 'Network error';
const retrying = params.get('retrying') === 'true';
const targetUrl = params.get('targetUrl') || '';

document.querySelector('#target-url').textContent = targetUrl;
document.querySelector('#retry-status').textContent = retrying
  ? 'Reconnecting automatically.'
  : 'Automatic retry stopped.';
document.querySelector('#technical-details').textContent = JSON.stringify(
  {
    errorCode,
    errorDescription,
    targetUrl
  },
  null,
  2
);

document.querySelector('#retry-button').addEventListener('click', () => {
  window.chatgptOffline.retry();
});

document.querySelector('#browser-button').addEventListener('click', () => {
  window.chatgptOffline.openInBrowser();
});
