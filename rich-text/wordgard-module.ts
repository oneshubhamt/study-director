// Wordgard as its own module (source/external/wordgard.js): the parts of each
// Wordgard package that Study Director's editor reaches, one namespace per
// package, plus the shared inert HTML parser that Wordgard's HTML reading
// uses. Study Director's editor (source/external/rich-text.js) reads them from
// globalThis.StudyDirectorWordgard.
export * as doc from 'wordgard/doc';
export * as types from 'wordgard/types';
export * as state from 'wordgard/state';
export * as editor from 'wordgard/editor';
export * as command from 'wordgard/command';
export * as history from 'wordgard/history';
export * as phrases from 'wordgard/phrases';
export * as set from 'wordgard/set';
export * as table from 'wordgard/table';
export * as inertHtml from 'wordgard/inert-html';
