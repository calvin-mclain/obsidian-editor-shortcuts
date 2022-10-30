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

describe('Code Editor Shortcuts: actions - multiple mixed selections', () => {
  let view: EditorViewWithLegacyMethods;
  let initialSelections: SelectionRange[];

  const originalDoc =
    `lorem ipsum\ndolor sit\namet\n\n` +
    `consectetur "adipiscing" 'elit'\n(donec [mattis])\ntincidunt metus`;
  const originalSelectionRanges = [
    { anchor: { line: 1, ch: 5 }, head: { line: 0, ch: 6 } }, // {<}ipsum\ndolor{>}
    { anchor: { line: 2, ch: 2 }, head: { line: 2, ch: 2 } }, // am{<>}et
    { anchor: { line: 4, ch: 14 }, head: { line: 4, ch: 17 } }, // a{<}dip{>}iscing
    { anchor: { line: 4, ch: 26 }, head: { line: 4, ch: 26 } }, // '{<>}elit
  ];
  const initialState = EditorState.create({
    doc: originalDoc,
  });

  beforeAll(() => {
    view = new EditorView({
      parent: document.body,
      state: initialState,
    });
    initialSelections = originalSelectionRanges.map((range) =>
      EditorSelection.range(
        posToOffset(view.state.doc, range.anchor),
        posToOffset(view.state.doc, range.head),
      ),
    );
    defineLegacyEditorMethods(view);
  });

  beforeEach(() => {
    view.setState(initialState);
    view.dispatch({ selection: EditorSelection.create(initialSelections) });
  });

  describe('insertLineAbove', () => {
    it('should insert line above', () => {
      withMultipleSelectionsNew(view as any, insertLineAbove);

      const { doc, selections } = getDocumentAndSelection(view as any);
      expect(doc).toEqual(
        `\nlorem ipsum\ndolor sit\n\namet\n\n\n\n` +
          `consectetur "adipiscing" 'elit'\n(donec [mattis])\ntincidunt metus`,
      );
      expect(selections).toEqual([
        {
          anchor: expect.objectContaining({ line: 0, ch: 0 }),
          head: expect.objectContaining({ line: 0, ch: 0 }),
        },
        {
          anchor: expect.objectContaining({ line: 3, ch: 0 }),
          head: expect.objectContaining({ line: 3, ch: 0 }),
        },
        {
          anchor: expect.objectContaining({ line: 6, ch: 0 }),
          head: expect.objectContaining({ line: 6, ch: 0 }),
        },
        {
          anchor: expect.objectContaining({ line: 7, ch: 0 }),
          head: expect.objectContaining({ line: 7, ch: 0 }),
        },
      ]);
    });

    describe('insertLineBelow', () => {
      it('should insert lines below', () => {
        withMultipleSelectionsNew(view as any, insertLineBelow);

        const { doc, selections } = getDocumentAndSelection(view as any);
        expect(doc).toEqual(
          `lorem ipsum\n\ndolor sit\namet\n\n\n` +
            `consectetur "adipiscing" 'elit'\n\n\n(donec [mattis])\ntincidunt metus`,
        );
        expect(selections).toEqual([
          {
            anchor: expect.objectContaining({ line: 1, ch: 0 }),
            head: expect.objectContaining({ line: 1, ch: 0 }),
          },
          {
            anchor: expect.objectContaining({ line: 4, ch: 0 }),
            head: expect.objectContaining({ line: 4, ch: 0 }),
          },
          {
            anchor: expect.objectContaining({ line: 7, ch: 0 }),
            head: expect.objectContaining({ line: 7, ch: 0 }),
          },
          {
            anchor: expect.objectContaining({ line: 8, ch: 0 }),
            head: expect.objectContaining({ line: 8, ch: 0 }),
          },
        ]);
      });
    });
  });
});
