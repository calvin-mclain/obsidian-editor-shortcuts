import { App, Editor } from 'obsidian';
import {
  CASE,
  DIRECTION,
  LOWERCASE_ARTICLES,
  MATCHING_BRACKETS,
  MATCHING_QUOTES,
  MatchingCharacterMap,
} from './constants';
import {
  CheckCharacter,
  findPosOfNextCharacter,
  getLeadingWhitespace,
  getLineEndPos,
  getLineStartPos,
  getSelectionBoundaries,
  wordRangeAtPos,
} from './utils';

export const insertLineAbove = (editor: Editor) => {
  const { line } = editor.getCursor();
  const startOfCurrentLine = getLineStartPos(line);
  editor.replaceRange('\n', startOfCurrentLine);
  editor.setSelection(startOfCurrentLine);
};

export const insertLineBelow = (editor: Editor) => {
  const { line } = editor.getCursor();
  const endOfCurrentLine = getLineEndPos(line, editor);
  const indentation = getLeadingWhitespace(editor.getLine(line));
  editor.replaceRange('\n' + indentation, endOfCurrentLine);
  editor.setSelection({ line: line + 1, ch: indentation.length });
};

export const deleteSelectedLines = (editor: Editor) => {
  const selections = editor.listSelections();
  if (selections.length === 0) {
    return;
  }
  const { from, to } = getSelectionBoundaries(selections[0]);
  if (to.line === editor.lastLine()) {
    // there is no 'next line' when cursor is on the last line
    editor.replaceRange(
      '',
      getLineEndPos(from.line - 1, editor),
      getLineEndPos(to.line, editor),
    );
  } else {
    editor.replaceRange(
      '',
      getLineStartPos(from.line),
      getLineStartPos(to.line + 1),
    );
  }
};

export const deleteToEndOfLine = (editor: Editor) => {
  const pos = editor.getCursor();
  const endPos = getLineEndPos(pos.line, editor);

  if (pos.line === endPos.line && pos.ch === endPos.ch) {
    // We're at the end of the line so delete just the newline
    endPos.line = endPos.line + 1;
    endPos.ch = 0;
  }

  editor.replaceRange('', pos, endPos);
};

export const joinLines = (editor: Editor) => {
  const { line } = editor.getCursor();
  const contentsOfNextLine = editor.getLine(line + 1).trimStart();
  const endOfCurrentLine = getLineEndPos(line, editor);
  const endOfNextLine = getLineEndPos(line + 1, editor);
  editor.replaceRange(
    contentsOfNextLine.length > 0
      ? ' ' + contentsOfNextLine
      : contentsOfNextLine,
    endOfCurrentLine,
    endOfNextLine,
  );
  editor.setSelection(endOfCurrentLine);
};

export const copyLine = (editor: Editor, direction: 'up' | 'down') => {
  const selections = editor.listSelections();
  if (selections.length === 0) {
    return;
  }
  const { from, to } = getSelectionBoundaries(selections[0]);
  const fromLineStart = getLineStartPos(from.line);
  const toLineEnd = getLineEndPos(to.line, editor);
  const contentsOfSelectedLines = editor.getRange(fromLineStart, toLineEnd);
  if (direction === 'up') {
    editor.replaceRange('\n' + contentsOfSelectedLines, toLineEnd);
    editor.setSelections(selections);
  } else {
    editor.replaceRange(contentsOfSelectedLines + '\n', fromLineStart);
  }
};

export const selectWord = (editor: Editor) => {
  const selections = editor.listSelections();
  const newSelections = selections.map((selection) => {
    const { from, to } = getSelectionBoundaries(selection);
    const selectedText = editor.getRange(from, to);
    // Do not modify selection if something is selected
    if (selectedText.length !== 0) {
      return selection;
    } else {
      return wordRangeAtPos(from, editor.getLine(from.line));
    }
  });
  editor.setSelections(newSelections);
};

export const selectLine = (editor: Editor) => {
  const selections = editor.listSelections();
  if (selections.length === 0) {
    return;
  }
  const { from, to } = getSelectionBoundaries(selections[0]);
  const startOfCurrentLine = getLineStartPos(from.line);
  // if a line is already selected, expand the selection to the next line
  const startOfNextLine = getLineStartPos(to.line + 1);
  editor.setSelection(startOfCurrentLine, startOfNextLine);
};

export const goToLineBoundary = (editor: Editor, boundary: 'start' | 'end') => {
  if (boundary === 'start') {
    const { line } = editor.getCursor('from');
    editor.setSelection(getLineStartPos(line));
  } else {
    const { line } = editor.getCursor('to');
    editor.setSelection(getLineEndPos(line, editor));
  }
};

export const navigateLine = (editor: Editor, direction: 'up' | 'down') => {
  const pos = editor.getCursor();
  let line: number;

  if (direction === 'up') {
    line = Math.max(pos.line - 1, 0);
  } else {
    line = Math.min(pos.line + 1, editor.lineCount() - 1);
  }

  const endOfLine = getLineEndPos(line, editor);
  const ch = Math.min(pos.ch, endOfLine.ch);

  editor.setSelection({ line, ch });
};

export const moveCursor = (editor: Editor, direction: DIRECTION) => {
  const { line, ch } = editor.getCursor();

  const movement = direction === DIRECTION.BACKWARD ? -1 : 1;
  const lineLength = editor.getLine(line).length;
  const newPos = { line, ch: ch + movement };

  if (newPos.ch < 0 && newPos.line === 0) {
    // Moving backward past start of doc, do nothing
    newPos.ch = ch;
  } else if (newPos.ch < 0) {
    // Wrap backward over start of line
    newPos.line = Math.max(newPos.line - 1, 0);
    newPos.ch = editor.getLine(newPos.line).length;
  } else if (newPos.ch > lineLength) {
    // Wrap forward over end of line
    newPos.line += 1;
    newPos.ch = 0;
  }

  editor.setSelection(newPos);
};

export const transformCase = (editor: Editor, caseType: CASE) => {
  const originalSelections = editor.listSelections();
  let selectedText = editor.getSelection();

  // apply transform on word at cursor if nothing is selected
  if (selectedText.length === 0) {
    const pos = editor.getCursor('from');
    const { anchor, head } = wordRangeAtPos(pos, editor.getLine(pos.line));
    editor.setSelection(anchor, head);
    selectedText = editor.getRange(anchor, head);
  }

  if (caseType === CASE.TITLE) {
    editor.replaceSelection(
      // use capture group to join with the same separator used to split
      selectedText
        .split(/(\s+)/)
        .map((word, index, allWords) => {
          if (
            index > 0 &&
            index < allWords.length - 1 &&
            LOWERCASE_ARTICLES.includes(word.toLowerCase())
          ) {
            return word.toLowerCase();
          }
          return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(''),
    );
  } else {
    editor.replaceSelection(
      caseType === CASE.UPPER
        ? selectedText.toUpperCase()
        : selectedText.toLowerCase(),
    );
  }

  // restore original selection after replacing content
  if (originalSelections.length > 0) {
    const { anchor, head } = originalSelections[0];
    editor.setSelection(anchor, head);
  }
};

const expandSelection = ({
  editor,
  openingCharacterCheck,
  matchingCharacterMap,
}: {
  editor: Editor;
  openingCharacterCheck: CheckCharacter;
  matchingCharacterMap: MatchingCharacterMap;
}) => {
  let anchor = editor.getCursor('anchor');
  let head = editor.getCursor('head');

  // in case user selects upwards
  if (anchor.line >= head.line && anchor.ch > anchor.ch) {
    [anchor, head] = [head, anchor];
  }

  const newAnchor = findPosOfNextCharacter({
    editor,
    startPos: anchor,
    checkCharacter: openingCharacterCheck,
    searchDirection: DIRECTION.BACKWARD,
  });
  if (!newAnchor) {
    return;
  }

  const newHead = findPosOfNextCharacter({
    editor,
    startPos: head,
    checkCharacter: (char: string) =>
      char === matchingCharacterMap[newAnchor.match],
    searchDirection: DIRECTION.FORWARD,
  });
  if (!newHead) {
    return;
  }

  editor.setSelection(newAnchor.pos, newHead.pos);
};

export const expandSelectionToBrackets = (editor: Editor) =>
  expandSelection({
    editor,
    openingCharacterCheck: (char: string) => /[([{]/.test(char),
    matchingCharacterMap: MATCHING_BRACKETS,
  });

export const expandSelectionToQuotes = (editor: Editor) =>
  expandSelection({
    editor,
    openingCharacterCheck: (char: string) => /['"`]/.test(char),
    matchingCharacterMap: MATCHING_QUOTES,
  });

export const goToHeading = (
  app: App,
  editor: Editor,
  boundary: 'prev' | 'next',
) => {
  const file = app.metadataCache.getFileCache(app.workspace.getActiveFile());
  if (!file.headings || file.headings.length === 0) {
    return;
  }

  const { line } = editor.getCursor('from');
  let prevHeadingLine = 0;
  let nextHeadingLine = editor.lastLine();

  file.headings.forEach(({ position }) => {
    const { end: headingPos } = position;
    if (line > headingPos.line && headingPos.line > prevHeadingLine) {
      prevHeadingLine = headingPos.line;
    }
    if (line < headingPos.line && headingPos.line < nextHeadingLine) {
      nextHeadingLine = headingPos.line;
    }
  });

  editor.setSelection(
    boundary === 'prev'
      ? getLineEndPos(prevHeadingLine, editor)
      : getLineEndPos(nextHeadingLine, editor),
  );
};