const escapeRe = (ch: string) => (/[.^$+{}()|\\]/.test(ch) ? `\\${ch}` : ch);

/**
 * Parse an extended glob pattern like ?(a|b|c)
 * Returns the regex string equivalent and the new index position
 */
const parseExtGlob = (
  pattern: string,
  startIdx: number,
  prefix: string,
  options?: GlobOptions,
): [regex: string, endIdx: number] | undefined => {
  let i = startIdx; // startIdx should be pointing at the character after '('
  const parts: string[] = [];
  let cur = '';
  let depth = 1; // Track parenthesis depth for nested patterns
  while (i < pattern.length && depth > 0) {
    const ch = pattern[i];
    if (ch === '(') {
      depth++;
      cur += ch;
      i++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        // Found the closing parenthesis
        parts.push(cur);
        i++; // consume ')'
        break;
      } else {
        cur += ch;
        i++;
      }
    } else if (ch === '|' && depth === 1) {
      // Pipe separator at top level of this extglob
      parts.push(cur);
      cur = '';
      i++;
    } else {
      cur += ch;
      i++;
    }
  }
  if (depth !== 0) return; // Unclosed parenthesis
  let alternatives = '';
  const length = parts.length;
  for (let j = 0; j < length; j++)
    alternatives += (alternatives ? '|' : '') + toRegex(parts[j], options).source.replace(/^\^/, '').replace(/\$$/, '');
  switch (prefix) {
    case '?': // zero or one
      return [`(?:${alternatives})?`, i];
    case '*': // zero or more
      return [`(?:${alternatives})*`, i];
    case '+': // one or more
      return [`(?:${alternatives})+`, i];
    case '@': // exactly one
      return [`(?:${alternatives})`, i];
    case '!': // none of (negative match)
      // For negation, we need to match anything that doesn't match the pattern
      // Use negative lookahead without consuming characters after
      return [`(?!${alternatives})[^/]*`, i];
  }
  return;
};

export interface GlobOptions {
  /** Treat pattern as case insensitive */
  nocase?: boolean;
  /** Enable extended globbing: ?(pattern), *(pattern), +(pattern), @(pattern), !(pattern) */
  extglob?: boolean;
}

/**
 * Convert a glob pattern to a regular expression
 *
 * Supports:
 * - `/` to separate path segments
 * - `*` to match zero or more characters in a path segment
 * - `?` to match one character in a path segment
 * - `**` to match any number of path segments, including none
 * - `{}` to group conditions (e.g. `{html,txt}`)
 * - `[abc]`, `[a-z]`, `[!a-z]`, `[!abc]` character classes
 * - Extended globbing (when `extglob: true` option is set):
 *   - `?(pattern-list)` zero or one occurrence
 *   - `*(pattern-list)` zero or more occurrences
 *   - `+(pattern-list)` one or more occurrences
 *   - `@(pattern-list)` exactly one of the patterns
 *   - `!(pattern-list)` anything except the patterns
 */
export const toRegex = (pattern: string, options?: GlobOptions): RegExp => {
  let regexStr = '';
  let i = 0;
  // Helper to parse a brace group like {a,b,c}. No nesting support.
  const parseBraceGroup = (): string => {
    // Assume current char is '{'
    i++; // skip '{'
    const parts: string[] = [];
    let cur = '';
    let closed = false;
    while (i < pattern.length) {
      const ch = pattern[i];
      if (ch === '}') {
        parts.push(cur);
        i++; // consume '}'
        closed = true;
        break;
      }
      if (ch === ',') {
        parts.push(cur);
        cur = '';
        i++;
        continue;
      }
      cur += ch;
      i++;
    }
    if (!closed) {
      // treat as literal '{...'
      return '\\{' + escapeRe(cur);
    }
    // Convert each part recursively to support globs inside braces
    const alt = parts.map((p) => toRegex(p, options).source.replace(/^\^/, '').replace(/\$$/, '')).join('|');
    return `(?:${alt})`;
  };
  const extglob = !!options?.extglob;

  while (i < pattern.length) {
    const char = pattern[i];

    // Check for extended glob patterns when extglob is enabled
    if (extglob && pattern[i + 1] === '(') {
      if (char === '?' || char === '*' || char === '+' || char === '@' || char === '!') {
        const result = parseExtGlob(pattern, i + 2, char, options);
        if (result) {
          regexStr += result[0];
          i = result[1];
          continue;
        }
        // If parse failed, fall through to normal handling
      }
    }

    switch (char) {
      case '*': {
        // Check for double star **
        if (pattern[i + 1] === '*') {
          // Collapse consecutive * beyond two (e.g., *** -> **)
          let j = i + 2;
          while (pattern[j] === '*') j++;
          // If followed by a slash, make it optional to allow zero segments
          if (pattern[j] === '/') {
            regexStr += '(?:.*/)?';
            i = j + 1; // consume **/
          } else {
            regexStr += '.*';
            i = j; // consume **
          }
        } else {
          regexStr += '[^/]*';
          i++;
        }
        break;
      }
      case '?':
        regexStr += '[^/]';
        i++;
        break;
      case '[': {
        // Copy character class as-is with support for leading '!'
        let cls = '[';
        i++;
        if (i < pattern.length && pattern[i] === '!') {
          cls += '^';
          i++;
        }
        // if first after [ or [^ is ']' include it literally
        if (i < pattern.length && pattern[i] === ']') {
          cls += ']';
          i++;
        }
        while (i < pattern.length && pattern[i] !== ']') {
          const ch = pattern[i];
          // Escape backslash inside class
          cls += ch === '\\' ? '\\\\' : ch;
          i++;
        }
        if (i < pattern.length && pattern[i] === ']') {
          cls += ']';
          i++;
        } else {
          // Unclosed class -> treat '[' literally
          regexStr += '\\[';
          continue;
        }
        regexStr += cls;
        break;
      }
      case '{': {
        regexStr += parseBraceGroup();
        break;
      }
      case '/':
        regexStr += '/';
        i++;
        break;
      case '.':
      case '^':
      case '$':
      case '+':
      case '(':
      case ')':
      case '|':
      case '\\':
        regexStr += `\\${char}`;
        i++;
        break;
      default:
        regexStr += char;
        i++;
        break;
    }
  }
  const flags = options?.nocase ? 'i' : '';
  return new RegExp('^' + regexStr + '$', flags);
};

/**
 * A glob pattern to match files paths against. An array or a single pattern
 * can be provided, if an array is given, then individual patterns will be
 * tested in order until one matches (OR short-circuits).
 *
 * For each pattern a string or a regular expression can be provided. If the
 * string starts with `/` and ends with `/<flags>?` it is treated as a regular
 * expression.
 */
export type Pattern = string | RegExp | (string | RegExp)[];
export type Matcher = (path: string) => boolean;

const isRegExp = /^\/(.{1,4096})\/([gimsuy]{0,6})$/;

export const toMatcher = (pattern: Pattern, options?: GlobOptions): Matcher => {
  const regexes: RegExp[] = [];
  const patterns: (string | RegExp)[] = Array.isArray(pattern) ? pattern : [pattern];
  for (const pat of patterns) {
    if (typeof pat === 'string') {
      const match = isRegExp.exec(pat);
      if (match) {
        const [, expr, flags] = match;
        regexes.push(new RegExp(expr, flags));
      } else {
        regexes.push(toRegex(pat, options));
      }
    } else {
      regexes.push(pat);
    }
  }
  return regexes.length
    ? (new Function('p', 'return ' + regexes.map((r) => r + '.test(p)').join('||')) as Matcher)
    : () => false;
};
