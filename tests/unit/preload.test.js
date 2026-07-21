const {
  findEditableTarget,
  handleAuxClick,
  isEditableElement
} = require('../../preload');

describe('preload baseline behavior', () => {
  test('identifies editable text inputs and textareas', () => {
    expect(isEditableElement({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isEditableElement({ tagName: 'INPUT', type: 'password' })).toBe(
      true
    );
    expect(isEditableElement({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableElement({ tagName: 'INPUT', type: 'checkbox' })).toBe(
      false
    );
    expect(isEditableElement({ tagName: 'TEXTAREA', readOnly: true })).toBe(
      false
    );
    expect(
      isEditableElement({ tagName: 'INPUT', type: 'text', disabled: true })
    ).toBe(false);
  });

  test('identifies contenteditable targets', () => {
    expect(isEditableElement({ isContentEditable: true, tagName: 'DIV' })).toBe(
      true
    );
  });

  test('finds an editable ancestor', () => {
    const editableParent = { tagName: 'TEXTAREA', parentElement: null };
    const child = { tagName: 'SPAN', parentElement: editableParent };

    expect(findEditableTarget(child)).toBe(editableParent);
  });

  test('middle-click paste invokes only the narrow preload IPC channel', () => {
    const ipc = { invoke: vi.fn() };
    const focus = vi.fn();
    const preventDefault = vi.fn();
    const target = { tagName: 'INPUT', type: 'text', focus };

    handleAuxClick({ button: 1, target, preventDefault }, ipc);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(ipc.invoke).toHaveBeenCalledWith(
      'chatgpt-desktop:paste-primary-selection'
    );
  });

  test('middle-click paste ignores non-editable targets', () => {
    const ipc = { invoke: vi.fn() };
    const preventDefault = vi.fn();
    const target = { tagName: 'DIV' };

    handleAuxClick({ button: 1, target, preventDefault }, ipc);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(ipc.invoke).not.toHaveBeenCalled();
  });

  test('middle-click paste ignores other mouse buttons', () => {
    const ipc = { invoke: vi.fn() };
    const preventDefault = vi.fn();
    const target = { tagName: 'INPUT', type: 'text' };

    handleAuxClick({ button: 0, target, preventDefault }, ipc);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(ipc.invoke).not.toHaveBeenCalled();
  });
});
