/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { ipcRenderer } = require('electron');

function isEditableElement(element) {
  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName ? element.tagName.toLowerCase() : '';

  if (tagName === 'textarea') {
    return !element.disabled && !element.readOnly;
  }

  if (tagName !== 'input') {
    return false;
  }

  const editableInputTypes = new Set([
    'email',
    'number',
    'password',
    'search',
    'tel',
    'text',
    'url'
  ]);

  const type = element.type || 'text';
  return editableInputTypes.has(type) && !element.disabled && !element.readOnly;
}

function findEditableTarget(startElement) {
  let element = startElement;

  while (element) {
    if (isEditableElement(element)) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

function handleAuxClick(event, ipc = ipcRenderer) {
  if (event.button !== 1) {
    return;
  }

  const editableTarget = findEditableTarget(event.target);

  if (!editableTarget) {
    return;
  }

  event.preventDefault();
  editableTarget.focus();
  ipc.invoke('chatgpt-desktop:paste-primary-selection');
}

if (typeof window !== 'undefined') {
  window.addEventListener('auxclick', handleAuxClick, true);

  window.addEventListener('DOMContentLoaded', () => {
    // Intentionally left minimal. Preload exists for future hardening/extensions.
  });
}

module.exports = {
  findEditableTarget,
  handleAuxClick,
  isEditableElement
};
