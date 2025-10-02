const escapeRe = (ch: string) => (/[.^$+{}()|\\]/.test(ch) ? `\\${ch}` : ch);

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
 */
export const toRegex = (pattern: string): RegExp => {
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
    const alt = parts.map((p) => toRegex(p).source.replace(/^\^/, '').replace(/\$$/, '')).join('|');
    return `(?:${alt})`;
  };

  while (i < pattern.length) {
    const char = pattern[i];
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
  return new RegExp('^' + regexStr + '$');
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

export const toMatcher = (pattern: Pattern): Matcher => {
  const regexes: RegExp[] = [];
  const patterns: (string | RegExp)[] = Array.isArray(pattern) ? pattern : [pattern];
  for (const pat of patterns) {
    if (typeof pat === 'string') {
      const match = isRegExp.exec(pat);
      if (match) {
        const [, expr, flags] = match;
        regexes.push(new RegExp(expr, flags));
      } else {
        regexes.push(toRegex(pat));
      }
    } else {
      regexes.push(pat);
    }
  }
  return regexes.length ? new Function('p', 'return ' + regexes.map(r => r + '.test(p)').join('||')) as Matcher : () => false;
};
