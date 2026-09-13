// biome-ignore lint/suspicious/noConstEnum: file-local, tsc compiler inlines
const enum Code {
  Bang = 33,
  Dollar = 36,
  LParen = 40,
  RParen = 41,
  Star = 42,
  Plus = 43,
  Comma = 44,
  Minus = 45,
  Dot = 46,
  Slash = 47,
  Colon = 58,
  Qmark = 63,
  At = 64,
  LBracket = 91,
  Backslash = 92,
  RBracket = 93,
  Caret = 94,
  LBrace = 123,
  Pipe = 124,
  RBrace = 125,
}

export interface GlobOptions {
  /** Treat pattern as case insensitive */
  nocase?: boolean;
  /** Enable extended globbing: ?(pattern), *(pattern), +(pattern), @(pattern), !(pattern) */
  extglob?: boolean;
  /** Whether `*`, `?`, `[...]` and extglobs match a leading `.` of a path segment. */
  dot?: boolean;
}

const NODOT = '(?!\\.)';
const STAR = '[^/]*';
const GLOBSTAR_NODOT = '[^/]*(?:/(?!\\.)[^/]*)*';

const literal = (pattern: string, i: number, code: number): string => {
  switch (code) {
    case Code.Dollar:
    case Code.LParen:
    case Code.RParen:
    case Code.Plus:
    case Code.Dot:
    case Code.Backslash:
    case Code.RBracket:
    case Code.Caret:
    case Code.LBrace:
    case Code.Pipe:
    case Code.RBrace:
      return '\\' + pattern[i];
    default:
      return pattern[i];
  }
};

const posixClass = (name: string): string | undefined => {
  switch (name) {
    case 'alnum':
      return '0-9A-Za-z';
    case 'alpha':
      return 'A-Za-z';
    case 'ascii':
      return '\\x00-\\x7f';
    case 'blank':
      return ' \\t';
    case 'cntrl':
      return '\\x00-\\x1f\\x7f';
    case 'digit':
      return '0-9';
    case 'graph':
      return '\\x21-\\x7e';
    case 'lower':
      return 'a-z';
    case 'print':
      return '\\x20-\\x7e';
    case 'punct':
      return '\\x21-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\x7e';
    case 'space':
      return ' \\t\\r\\n\\v\\f';
    case 'upper':
      return 'A-Z';
    case 'word':
      return '0-9A-Za-z_';
    case 'xdigit':
      return '0-9A-Fa-f';
  }
  return;
};

const classEnd = (pattern: string, i: number): number => {
  const length = pattern.length;
  let j = i + 1;
  const first = pattern.charCodeAt(j);
  if (first === Code.Bang || first === Code.Caret) j++;
  if (pattern.charCodeAt(j) === Code.RBracket) j++;
  for (; j < length; j++) {
    const code = pattern.charCodeAt(j);
    if (code === Code.RBracket) return j + 1;
    if (code === Code.LBracket && pattern.charCodeAt(j + 1) === Code.Colon) {
      const close = pattern.indexOf(':]', j + 2);
      if (close > 0) j = close + 1;
    }
  }
  return -1;
};

const member = (pattern: string, i: number): string => {
  const code = pattern.charCodeAt(i);
  const special =
    code === Code.RBracket ||
    code === Code.Backslash ||
    code === Code.LBracket ||
    code === Code.Caret ||
    code === Code.Minus;
  return (special ? '\\' : '') + pattern[i];
};

const classSource = (pattern: string, i: number, end: number): string => {
  const last = end - 1;
  let j = i + 1;
  let out = '';
  let members = 0;
  const first = pattern.charCodeAt(j);
  const negate = first === Code.Bang || first === Code.Caret;
  if (negate) j++;
  while (j < last) {
    if (pattern.charCodeAt(j) === Code.LBracket && pattern.charCodeAt(j + 1) === Code.Colon) {
      const close = pattern.indexOf(':]', j + 2);
      const cls = close > 0 ? posixClass(pattern.slice(j + 2, close)) : undefined;
      if (cls !== undefined) {
        out += cls;
        members += 2;
        j = close + 2;
        continue;
      }
    }
    if (pattern.charCodeAt(j + 1) === Code.Minus && j + 2 < last) {
      if (pattern.charCodeAt(j + 2) >= pattern.charCodeAt(j)) {
        out += member(pattern, j) + '-' + member(pattern, j + 2);
        members += 2;
      }
      j += 3;
      continue;
    }
    out += member(pattern, j);
    members++;
    j++;
  }
  if (!negate && members === 1) return literal(pattern, last - 1, pattern.charCodeAt(last - 1));
  if (!members) return negate ? '[^/]' : '[]';
  return (negate ? '[^' : '[') + out + ']';
};

const groupEnd = (pattern: string, i: number): number => {
  const length = pattern.length;
  let depth = 1;
  for (; i < length; i++) {
    const code = pattern.charCodeAt(i);
    if (code === Code.LBracket) {
      const end = classEnd(pattern, i);
      if (end > 0) i = end - 1;
    } else if (code === Code.LParen) depth++;
    else if (code === Code.RParen && !--depth) return i + 1;
  }
  return -1;
};

const splitAlts = (body: string): string[] => {
  const length = body.length;
  const alts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < length; i++) {
    const code = body.charCodeAt(i);
    if (code === Code.LBracket) {
      const end = classEnd(body, i);
      if (end > 0) i = end - 1;
    } else if (code === Code.LParen) depth++;
    else if (code === Code.RParen) depth--;
    else if (code === Code.Pipe && !depth) {
      alts.push(body.slice(from, i));
      from = i + 1;
    }
  }
  alts.push(body.slice(from));
  return alts;
};

const isExtglobPrefix = (code: number): boolean =>
  code === Code.Qmark || code === Code.Star || code === Code.Plus || code === Code.At || code === Code.Bang;

const altsSource = (alts: string[], extglob: boolean, nodot: boolean, tail: string, segStart: boolean): string => {
  let out = '';
  for (let i = 0; i < alts.length; i++) out += (i ? '|' : '') + compile(alts[i], extglob, nodot, tail, segStart);
  return out;
};

const extglobSource = (
  type: number,
  alts: string[],
  extglob: boolean,
  nodot: boolean,
  tail: string,
  segStart: boolean,
): string => {
  const guard = nodot && segStart ? NODOT : '';
  const body = altsSource(alts, extglob, nodot, tail, segStart);
  switch (type) {
    case Code.Qmark:
      return '(?:' + body + ')?';
    case Code.At:
      return '(?:' + body + ')';
    case Code.Bang:
      if (alts.length === 1 && !alts[0]) return guard + '[^/]+';
      return '(?!(?:' + body + ')' + tail + '$)' + guard + STAR;
  }
  const more = guard ? altsSource(alts, extglob, nodot, tail, false) : body;
  if (more === body) return '(?:' + body + ')' + (type === Code.Star ? '*' : '+');
  const once = '(?:' + body + ')(?:' + more + ')*';
  return type === Code.Star ? '(?:' + once + ')?' : once;
};

const compile = (pattern: string, extglob: boolean, nodot: boolean, tail: string, segStart: boolean): string => {
  const length = pattern.length;
  let out = '';
  let i = 0;
  let start = segStart;
  while (i < length) {
    const code = pattern.charCodeAt(i);
    if (extglob && pattern.charCodeAt(i + 1) === Code.LParen && isExtglobPrefix(code)) {
      const end = groupEnd(pattern, i + 2);
      if (end > 0) {
        const after = compile(pattern.slice(end), extglob, nodot, tail, false);
        const alts = splitAlts(pattern.slice(i + 2, end - 1));
        return out + extglobSource(code, alts, extglob, nodot, after + tail, start) + after;
      }
    }
    const atStart = start;
    const guard = nodot && atStart ? NODOT : '';
    start = false;
    switch (code) {
      case Code.Star: {
        let j = i + 1;
        while (pattern.charCodeAt(j) === Code.Star) j++;
        if (j === i + 1) {
          // a whole segment of `*` needs a character: a file name is never empty
          const whole = atStart && (j === length || pattern.charCodeAt(j) === Code.Slash);
          out += guard + (whole ? '[^/]+' : STAR);
          i = j;
          break;
        }
        // `**/**/` is `**/`, and `**/**` is `**`: a second globstar only multiplies the backtracking
        let slash = pattern.charCodeAt(j) === Code.Slash;
        while (slash) {
          let k = j + 1;
          if (pattern.charCodeAt(k) !== Code.Star || pattern.charCodeAt(k + 1) !== Code.Star) break;
          k += 2;
          while (pattern.charCodeAt(k) === Code.Star) k++;
          if (k === length) {
            j = k;
            slash = false;
          } else if (pattern.charCodeAt(k) === Code.Slash) j = k;
          else break;
        }
        if (slash) {
          out += nodot ? '(?:' + guard + GLOBSTAR_NODOT + '/)?' : '(?:.*/)?';
          j++;
          start = true;
        } else out += nodot ? guard + GLOBSTAR_NODOT : '.*';
        i = j;
        break;
      }
      case Code.Qmark:
        out += guard + '[^/]';
        i++;
        break;
      case Code.LBracket: {
        const end = classEnd(pattern, i);
        if (end < 0) {
          out += '\\[';
          i++;
          break;
        }
        const cls = classSource(pattern, i, end);
        out += (cls.charCodeAt(0) === Code.LBracket ? guard : '') + cls;
        i = end;
        break;
      }
      case Code.Slash:
        out += '/';
        i++;
        start = true;
        break;
      default:
        out += literal(pattern, i, code);
        i++;
    }
  }
  return out;
};

const closingBrace = (pattern: string, open: number): number => {
  const length = pattern.length;
  let depth = 0;
  for (let i = open; i < length; i++) {
    const code = pattern.charCodeAt(i);
    if (code === Code.LBrace) depth++;
    else if (code === Code.RBrace && !--depth) return i;
  }
  return -1;
};

const commaSplit = (body: string): string[] | undefined => {
  const length = body.length;
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < length; i++) {
    const code = body.charCodeAt(i);
    if (code === Code.LBrace) depth++;
    else if (code === Code.RBrace) depth--;
    else if (code === Code.Comma && !depth) {
      parts.push(body.slice(from, i));
      from = i + 1;
    }
  }
  if (!parts.length) return;
  parts.push(body.slice(from));
  return parts;
};

const NUMERIC_RANGE = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/;
const ALPHA_RANGE = /^([a-zA-Z])\.\.([a-zA-Z])(?:\.\.(-?\d+))?$/;
const PADDED = /^-?0\d/;

const rangeOf = (body: string, max: number): string[] | undefined => {
  let match = NUMERIC_RANGE.exec(body);
  const alpha = !match;
  if (alpha) match = ALPHA_RANGE.exec(body);
  if (!match) return;
  const from = alpha ? match[1].charCodeAt(0) : +match[1];
  const to = alpha ? match[2].charCodeAt(0) : +match[2];
  const step = match[3] === undefined ? 1 : Math.abs(+match[3]) || 1;
  const width =
    !alpha && (PADDED.test(match[1]) || PADDED.test(match[2])) ? Math.max(match[1].length, match[2].length) : 0;
  const out: string[] = [];
  const dir = from <= to ? step : -step;
  for (let n = from; (dir > 0 ? n <= to : n >= to) && out.length < max; n += dir) {
    if (alpha) {
      out.push(String.fromCharCode(n));
      continue;
    }
    let s = String(n);
    const need = width - s.length;
    if (need > 0) {
      let zeros = '';
      for (let k = 0; k < need; k++) zeros += '0';
      s = n < 0 ? '-' + zeros + s.slice(1) : zeros + s;
    }
    out.push(s);
  }
  return out;
};

const expandInto = (pattern: string, out: string[], max: number): void => {
  for (let open = pattern.indexOf('{'); open >= 0; open = pattern.indexOf('{', open + 1)) {
    const close = closingBrace(pattern, open);
    if (close < 0) continue;
    const body = pattern.slice(open + 1, close);
    const alts = commaSplit(body) || rangeOf(body, max);
    if (!alts) continue;
    const prefix = pattern.slice(0, open);
    const suffixes = expandBraces(pattern.slice(close + 1), max);
    for (let i = 0; i < alts.length; i++) {
      const heads = expandBraces(alts[i], max);
      for (let j = 0; j < heads.length; j++) {
        const head = prefix + heads[j];
        for (let k = 0; k < suffixes.length; k++) {
          if (out.length >= max) return;
          out.push(head + suffixes[k]);
        }
      }
    }
    return;
  }
  out.push(pattern);
};

/**
 * Expands `{a,b}` alternations and `{1..3}`, `{a..c}`, `{01..10..2}` ranges the
 * way bash does, nesting included. A group with neither a comma nor a range,
 * or without its closing brace, is kept as it is.
 *
 * @param max Number of expansions to stop at, as `brace-expansion` does.
 */
export const expandBraces = (pattern: string, max = 100_000): string[] => {
  const out: string[] = [];
  expandInto(pattern, out, max);
  return out;
};

/**
 * Convert a glob pattern to a regular expression
 *
 * Supports:
 * - `/` to separate path segments
 * - `*` to match zero or more characters in a path segment
 * - `?` to match one character in a path segment
 * - `**` to match any number of path segments, including none
 * - `{}` to group conditions (e.g. `{html,txt}`), nested, and `{1..3}` ranges
 * - `[abc]`, `[a-z]`, `[!a-z]`, `[!abc]`, `[[:alpha:]]` character classes
 * - Extended globbing (when `extglob: true` option is set):
 *   - `?(pattern-list)` zero or one occurrence
 *   - `*(pattern-list)` zero or more occurrences
 *   - `+(pattern-list)` one or more occurrences
 *   - `@(pattern-list)` exactly one of the patterns
 *   - `!(pattern-list)` anything except the patterns
 */
export const toRegex = (pattern: string, options?: GlobOptions): RegExp => {
  const extglob = !!options?.extglob;
  const nodot = options?.dot === false;
  let source: string;
  if (pattern.indexOf('{') < 0) source = compile(pattern, extglob, nodot, '', true);
  else {
    const set = expandBraces(pattern);
    const length = set.length;
    if (length === 1) source = compile(set[0], extglob, nodot, '', true);
    else {
      const seen = new Set<string>();
      source = '(?:';
      for (let i = 0; i < length; i++) {
        const one = set[i];
        if (seen.has(one)) continue;
        if (seen.size) source += '|';
        seen.add(one);
        source += compile(one, extglob, nodot, '', true);
      }
      source += ')';
    }
  }
  return new RegExp('^' + source + '$', options?.nocase ? 'i' : '');
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
