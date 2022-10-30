import {
  EditorSelection,
  EditorState,
  SelectionRange,
} from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  defineLegacyEditorMethods,
  EditorViewWithLegacyMethods,
  getDocumentAndSelection,
  posToOffset,
} from './test-helpers';
import { insertLineAbove, insertLineBelow } from '../actions';
import { withMultipleSelectionsNew } from '../utils';

describe('Code Editor Shortcuts: actions - single cursor selection', () => {
  let view: EditorViewWithLegacyMethods;
  let initialSelection: SelectionRange;

  const originalDoc = 'lorem ipsum\ndolor sit\namet';
  const initialState = EditorState.create({
    doc: originalDoc,
  });

  beforeAll(() => {
    view = new EditorView({
      parent: document.body,
      state: initialState,
    });
    initialSelection = EditorSelection.cursor(
      posToOffset(view.state.doc, { line: 1, ch: 0 }),
    );
    defineLegacyEditorMethods(view);
  });

  beforeEach(() => {
    view.setState(initialState);
    view.dispatch({ selection: EditorSelection.create([initialSelection]) });
  });

  describe('insertLineAbove', () => {
    it('should insert line above', () => {
      withMultipleSelectionsNew(view as any, insertLineAbove);

      const { doc, cursor } = getDocumentAndSelection(view as any);
      expect(doc).toEqual('lorem ipsum\n\ndolor sit\namet');
      expect(cursor.line).toEqual(1);
    });

    it('should insert line above first line', () => {
      view.setCursor({ line: 0, ch: 0 });

      withMultipleSelectionsNew(view as any, insertLineAbove);

      const { doc, cursor } = getDocumentAndSelection(view as any);
      expect(doc).toEqual('\nlorem ipsum\ndolor sit\namet');
      expect(cursor.line).toEqual(0);
    });
  });

  describe('insertLineBelow', () => {
    it('should insert line below', () => {
      withMultipleSelectionsNew(view as any, insertLineBelow);

      const { doc, cursor } = getDocumentAndSelection(view as any);
      expect(doc).toEqual('lorem ipsum\ndolor sit\n\namet');
      expect(cursor.line).toEqual(2);
    });

    it('should insert line below with the same indentation level', () => {
      view.setState(
        EditorState.create({ doc: '    lorem ipsum\n    dolor sit\n    amet' }),
      );
      view.setCursor({ line: 1, ch: 0 });

      withMultipleSelectionsNew(view as any, insertLineBelow);

      const { doc, cursor } = getDocumentAndSelection(view as any);
      expect(doc).toEqual('    lorem ipsum\n    dolor sit\n    \n    amet');
      expect(cursor.line).toEqual(2);
      expect(cursor.ch).toEqual(4);
    });

    it('should insert line below last line', () => {
      view.setCursor({ line: 2, ch: 0 });

      withMultipleSelectionsNew(view as any, insertLineBelow);

      const { doc, cursor } = getDocumentAndSelection(view as any);
      expect(doc).toEqual('lorem ipsum\ndolor sit\namet\n');
      expect(cursor.line).toEqual(3);
    });
  });
});
