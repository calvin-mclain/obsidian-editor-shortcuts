import {
  Editor,
  EditorChange,
  EditorRangeOrCaret,
  EditorPosition,
  EditorSelection,
  EditorSelectionOrCaret,
} from 'obsidian';
import { DIRECTION } from './constants';
import { CustomSelectionHandler } from './custom-selection-handlers';

type EditorActionCallbackNew = (
  editor: Editor,
  selection: EditorSelection,
  args: any,
) => { changes: EditorChange[]; newSelection: EditorRangeOrCaret };

type EditorActionCallback = (
  editor: Editor,
  selection: EditorSelection,
  args: string,
) => EditorSelectionOrCaret;

type MultipleSelectionOptions = {
  // Additional information to be passed to the EditorActionCallback
  args?: string;

  // Perform further processing of new selections before they are set
  customSelectionHandler?: CustomSelectionHandler;

  // Whether the action should be repeated for cursors on the same line
  repeatSameLineActions?: boolean;
};

export type EditorActionCallbackNewArgs = Record<string, any>;

type MultipleSelectionOptionsNew = {
  // Additional information to be passed to the EditorActionCallback
  args?: EditorActionCallbackNewArgs;

  // Whether the action should be repeated for cursors on the same line
  repeatSameLineActions?: boolean;
};

export const defaultMultipleSelectionOptions = { repeatSameLineActions: true };

export const withMultipleSelectionsNew = (
  editor: Editor,
  callback: EditorActionCallbackNew,
  options: MultipleSelectionOptionsNew = defaultMultipleSelectionOptions,
) => {
  const selections = editor.listSelections();
  let selectionIndexesToProcess: number[];
  const newSelections: EditorRangeOrCaret[] = [];
  const changes: EditorChange[] = [];

  if (!options.repeatSameLineActions) {
    const seenLines: number[] = [];
    selectionIndexesToProcess = selections.reduce(
      (indexes, currSelection, currIndex) => {
        const currentLine = currSelection.head.line;
        if (!seenLines.includes(currentLine)) {
          seenLines.push(currentLine);
          indexes.push(currIndex);
        }
        return indexes;
      },
      [],
    );
  }

  for (let i = 0; i < selections.length; i++) {
    // Controlled by repeatSameLineActions
    if (selectionIndexesToProcess && !selectionIndexesToProcess.includes(i)) {
      continue;
    }

    // Can't reuse selections variable as positions may change on each iteration
    const selection = editor.listSelections()[i];

    // Selections may disappear (e.g. running delete line for two cursors on the same line)
    if (selection) {
      const { changes: newChanges, newSelection } = callback(
        editor,
        selection,
        {
          ...options.args,
          iteration: i,
        },
      );
      changes.push(...newChanges);
      newSelections.push(newSelection);
    }
  }

  editor.transaction({
    changes,
    selections: newSelections,
  });
};

export const withMultipleSelections = (
  editor: Editor,
  callback: EditorActionCallback,
  options: MultipleSelectionOptions = defaultMultipleSelectionOptions,
) => {
  // @ts-expect-error: Obsidian's Editor interface does not explicitly
  // include the CodeMirror cm object, but it is there when using the
  // legacy editor
  const { cm } = editor;

  const selections = editor.listSelections();
  let selectionIndexesToProcess: number[];
  let newSelections: EditorSelectionOrCaret[] = [];

  if (!options.repeatSameLineActions) {
    const seenLines: number[] = [];
    selectionIndexesToProcess = selections.reduce(
      (indexes, currSelection, currIndex) => {
        const currentLine = currSelection.head.line;
        if (!seenLines.includes(currentLine)) {
          seenLines.push(currentLine);
          indexes.push(currIndex);
        }
        return indexes;
      },
      [],
    );
  }

  const applyCallbackOnSelections = () => {
    for (let i = 0; i < selections.length; i++) {
      // Controlled by repeatSameLineActions
      if (selectionIndexesToProcess && !selectionIndexesToProcess.includes(i)) {
        continue;
      }

      // Can't reuse selections variable as positions may change on each iteration
      const selection = editor.listSelections()[i];

      // Selections may disappear (e.g. running delete line for two cursors on the same line)
      if (selection) {
        const newSelection = callback(editor, selection, options.args);
        newSelections.push(newSelection);
      }
    }

    if (options.customSelectionHandler) {
      newSelections = options.customSelectionHandler(newSelections);
    }
    editor.setSelections(newSelections);
  };

  if (cm && cm.operation) {
    // Group all the updates into one atomic operation (so undo/redo work as expected)
    cm.operation(applyCallbackOnSelections);
  } else {
    // Safe fallback if cm doesn't exist (so undo/redo will step through each change)
    console.debug('cm object not found, operations will not be buffered');
    applyCallbackOnSelections();
  }
};

/**
 * Executes the supplied callback for each top-level CodeMirror div element in the
 * DOM. This is an interim util made to work with both CM5 and CM6 as Obsidian's
 * `iterateCodeMirrors` method only works with the CM5.
 */
export const iterateCodeMirrorDivs = (callback: (cm: HTMLElement) => any) => {
  let codeMirrors: NodeListOf<HTMLElement>;
  codeMirrors = document.querySelectorAll('.cm-content'); // CM6
  if (codeMirrors.length === 0) {
    codeMirrors = document.querySelectorAll('.CodeMirror'); // CM5
  }
  codeMirrors.forEach(callback);
};

export const getLineStartPos = (line: number): EditorPosition => ({
  line,
  ch: 0,
});

export const getLineEndPos = (
  line: number,
  editor: Editor,
): EditorPosition => ({
  line,
  ch: editor.getLine(line).length,
});

export const getSelectionBoundaries = (selection: EditorSelection) => {
  let { anchor: from, head: to } = selection;

  // in case user selects upwards
  if (from.line > to.line) {
    [from, to] = [to, from];
  }

  // in case user selects backwards on the same line
  if (from.line === to.line && from.ch > to.ch) {
    [from, to] = [to, from];
  }

  return { from, to };
};

export const getLeadingWhitespace = (lineContent: string) => {
  const indentation = lineContent.match(/^\s+/);
  return indentation ? indentation[0] : '';
};

// Match any character from any language: https://www.regular-expressions.info/unicode.html
const isLetterCharacter = (char: string) => /\p{L}\p{M}*/u.test(char);

export const wordRangeAtPos = (
  pos: EditorPosition,
  lineContent: string,
): { anchor: EditorPosition; head: EditorPosition } => {
  let start = pos.ch;
  let end = pos.ch;
  while (start > 0 && isLetterCharacter(lineContent.charAt(start - 1))) {
    start--;
  }
  while (
    end < lineContent.length &&
    isLetterCharacter(lineContent.charAt(end))
  ) {
    end++;
  }
  return {
    anchor: {
      line: pos.line,
      ch: start,
    },
    head: {
      line: pos.line,
      ch: end,
    },
  };
};

export type CheckCharacter = (char: string) => boolean;

export const findPosOfNextCharacter = ({
  editor,
  startPos,
  checkCharacter,
  searchDirection,
}: {
  editor: Editor;
  startPos: EditorPosition;
  checkCharacter: CheckCharacter;
  searchDirection: DIRECTION;
}) => {
  let { line, ch } = startPos;
  let lineContent = editor.getLine(line);
  let matchFound = false;
  let matchedChar: string;

  if (searchDirection === DIRECTION.BACKWARD) {
    while (line >= 0) {
      // ch will initially be 0 if searching from start of line
      const char = lineContent.charAt(Math.max(ch - 1, 0));
      matchFound = checkCharacter(char);
      if (matchFound) {
        matchedChar = char;
        break;
      }
      ch--;
      // inclusive because (ch - 1) means the first character will already
      // have been checked
      if (ch <= 0) {
        line--;
        if (line >= 0) {
          lineContent = editor.getLine(line);
          ch = lineContent.length;
        }
      }
    }
  } else {
    while (line < editor.lineCount()) {
      const char = lineContent.charAt(ch);
      matchFound = checkCharacter(char);
      if (matchFound) {
        matchedChar = char;
        break;
      }
      ch++;
      if (ch >= lineContent.length) {
        line++;
        lineContent = editor.getLine(line);
        ch = 0;
      }
    }
  }

  return matchFound
    ? {
        match: matchedChar,
        pos: {
          line,
          ch,
        },
      }
    : null;
};

export const hasSameSelectionContent = (
  editor: Editor,
  selections: EditorSelection[],
) =>
  new Set(
    selections.map((selection) => {
      const { from, to } = getSelectionBoundaries(selection);
      return editor.getRange(from, to);
    }),
  ).size === 1;

export const getSearchText = ({
  editor,
  allSelections,
  autoExpand,
}: {
  editor: Editor;
  allSelections: EditorSelection[];
  autoExpand: boolean;
}) => {
  // Don't search if multiple selection contents are not identical
  const singleSearchText = hasSameSelectionContent(editor, allSelections);
  const firstSelection = allSelections[0];
  const { from, to } = getSelectionBoundaries(firstSelection);
  let searchText = editor.getRange(from, to);
  if (searchText.length === 0 && autoExpand) {
    const wordRange = wordRangeAtPos(from, editor.getLine(from.line));
    searchText = editor.getRange(wordRange.anchor, wordRange.head);
  }
  return {
    searchText,
    singleSearchText,
  };
};

/**
 * Escapes any special regex characters in the given string.
 *
 * Adapted from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 */
const escapeRegex = (input: string) =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string

/**
 * Constructs a custom regex query with word boundaries because in `\b` in JS doesn't
 * match word boundaries for unicode characters, even with the unicode flag on.
 *
 * Adapted from https://shiba1014.medium.com/regex-word-boundaries-with-unicode-207794f6e7ed.
 */
const withWordBoundaries = (input: string) => `(?<=\\W|^)${input}(?=\\W|$)`;

export const findAllMatches = ({
  searchText,
  searchWithinWords,
  documentContent,
}: {
  searchText: string;
  searchWithinWords: boolean;
  documentContent: string;
}) => {
  const escapedSearchText = escapeRegex(searchText);
  const searchExpression = new RegExp(
    searchWithinWords
      ? escapedSearchText
      : withWordBoundaries(escapedSearchText),
    'g',
  );
  return Array.from(documentContent.matchAll(searchExpression));
};

export const findNextMatchPosition = ({
  editor,
  latestMatchPos,
  searchText,
  searchWithinWords,
  documentContent,
}: {
  editor: Editor;
  latestMatchPos: EditorPosition;
  searchText: string;
  searchWithinWords: boolean;
  documentContent: string;
}) => {
  const latestMatchOffset = editor.posToOffset(latestMatchPos);
  const matches = findAllMatches({
    searchText,
    searchWithinWords,
    documentContent,
  });
  let nextMatch: EditorSelection | null = null;

  for (const match of matches) {
    if (match.index > latestMatchOffset) {
      nextMatch = {
        anchor: editor.offsetToPos(match.index),
        head: editor.offsetToPos(match.index + searchText.length),
      };
      break;
    }
  }
  // Circle back to search from the top
  if (!nextMatch) {
    const selectionIndexes = editor.listSelections().map((selection) => {
      const { from } = getSelectionBoundaries(selection);
      return editor.posToOffset(from);
    });
    for (const match of matches) {
      if (!selectionIndexes.includes(match.index)) {
        nextMatch = {
          anchor: editor.offsetToPos(match.index),
          head: editor.offsetToPos(match.index + searchText.length),
        };
        break;
      }
    }
  }

  return nextMatch;
};

export const findAllMatchPositions = ({
  editor,
  searchText,
  searchWithinWords,
  documentContent,
}: {
  editor: Editor;
  searchText: string;
  searchWithinWords: boolean;
  documentContent: string;
}) => {
  const matches = findAllMatches({
    searchText,
    searchWithinWords,
    documentContent,
  });
  const matchPositions = [];
  for (const match of matches) {
    matchPositions.push({
      anchor: editor.offsetToPos(match.index),
      head: editor.offsetToPos(match.index + searchText.length),
    });
  }
  return matchPositions;
};
