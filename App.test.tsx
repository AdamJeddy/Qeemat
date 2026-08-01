import React from 'react';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { AddScreen } from './App';

describe('AddScreen', () => {
  it('replaces the entered URL when a new shared URL arrives', () => {
    const navigate = jest.fn();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <AddScreen initialUrl="https://www.noon.com/first" navigate={navigate} />
      );
    });

    act(() => {
      tree!.update(
        <AddScreen initialUrl="https://www.noon.com/second" navigate={navigate} />
      );
    });

    expect(tree!.root.findByType(TextInput).props.value).toBe('https://www.noon.com/second');
  });
});
