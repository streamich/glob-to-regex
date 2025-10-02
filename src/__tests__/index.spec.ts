import {describe, test, expect} from 'vitest';
import {toMatcher, toRegex} from '..';

describe('glob-to-regex/toRegex', () => {
  test('literal path', () => {
    const re = toRegex('a/b/c.txt');
    expect(re.test('a/b/c.txt')).toBe(true);
    expect(re.test('a/b/c.tx')).toBe(false);
  });

  test('* matches within a segment', () => {
    const re = toRegex('a/*.txt');
    expect(re.test('a/test.txt')).toBe(true);
    expect(re.test('a/.txt')).toBe(true);
    expect(re.test('a/test.tx')).toBe(false);
    expect(re.test('a/b/test.txt')).toBe(false);
  });

  test('? matches a single char within a segment', () => {
    const re = toRegex('file?.js');
    expect(re.test('file1.js')).toBe(true);
    expect(re.test('fileA.js')).toBe(true);
    expect(re.test('file10.js')).toBe(false);
  });

  test('** matches across segments', () => {
    const re = toRegex('src/**/test.ts');
    expect(re.test('src/test.ts')).toBe(true);
    expect(re.test('src/a/test.ts')).toBe(true);
    expect(re.test('src/a/b/test.ts')).toBe(true);
    expect(re.test('src/a/b/c/test.ts')).toBe(true);
    expect(re.test('src/a/b/test.tsx')).toBe(false);
    expect(re.test('src/a/b/c/test.ts')).toBe(true);
    expect(re.test('src/a/b/c/test.ts ')).toBe(false);
    expect(re.test(' src/a/b/c/test.ts')).toBe(false);
  });

  test('** at end', () => {
    const re = toRegex('assets/**');
    expect(re.test('assets/')).toBe(true);
    expect(re.test('assets/a')).toBe(true);
    expect(re.test('assets/a/b/c.png')).toBe(true);
    expect(re.test('asset/a')).toBe(false);
  });

  test('brace groups {}', () => {
    const re = toRegex('*.{html,txt}');
    expect(re.test('a.html')).toBe(true);
    expect(re.test('a.txt')).toBe(true);
    expect(re.test('a.htm')).toBe(false);
  });

  test('brace groups with paths', () => {
    const re = toRegex('src/{a,b}/**/*.ts');
    expect(re.test('src/a/x.ts')).toBe(true);
    expect(re.test('src/b/x/y.ts')).toBe(true);
    expect(re.test('src/c/x.ts')).toBe(false);
  });

  test('character classes []', () => {
    const re = toRegex('file[0-9].txt');
    expect(re.test('file0.txt')).toBe(true);
    expect(re.test('file5.txt')).toBe(true);
    expect(re.test('filea.txt')).toBe(false);
  });

  test('negated character classes [!...]', () => {
    const re = toRegex('file[!0-9].txt');
    expect(re.test('filea.txt')).toBe(true);
    expect(re.test('file_.txt')).toBe(true);
    expect(re.test('file5.txt')).toBe(false);
  });

  test('mixed: ** with class and braces', () => {
    const re = toRegex('**/*.[jt]s{,x}');
    expect(re.test('a.ts')).toBe(true);
    expect(re.test('a.tsx')).toBe(true);
    expect(re.test('a.js')).toBe(true);
    expect(re.test('dir/a/b.jsx')).toBe(true);
    expect(re.test('a.cs')).toBe(false);
  });
});

describe('glob-to-regex/toMatcher', () => {
  test('literal path', () => {
    const matcher = toMatcher('a/b/c.txt');
    expect(matcher('a/b/c.txt')).toBe(true);
    expect(matcher('a/b/c.tx')).toBe(false);
  });

  test('* matches within a segment', () => {
    const matcher = toMatcher('a/*.txt');
    expect(matcher('a/test.txt')).toBe(true);
    expect(matcher('a/.txt')).toBe(true);
    expect(matcher('a/test.tx')).toBe(false);
    expect(matcher('a/b/test.txt')).toBe(false);
  });

  test('? matches a single char', () => {
    const matcher = toMatcher('file?.js');
    expect(matcher('file1.js')).toBe(true);
    expect(matcher('fileA.js')).toBe(true);
    expect(matcher('file10.js')).toBe(false);
  });

  test('** matches across segments', () => {
    const matcher = toMatcher('src/**/test.ts');
    expect(matcher('src/test.ts')).toBe(true);
    expect(matcher('src/a/test.ts')).toBe(true);
    expect(matcher('src/a/b/c/test.ts')).toBe(true);
    expect(matcher('src/a/b/test.tsx')).toBe(false);
  });

  test('brace groups {}', () => {
    const matcher = toMatcher('*.{html,txt}');
    expect(matcher('a.html')).toBe(true);
    expect(matcher('a.txt')).toBe(true);
    expect(matcher('a.htm')).toBe(false);
  });

  test('character classes []', () => {
    const matcher = toMatcher('file[0-9].txt');
    expect(matcher('file0.txt')).toBe(true);
    expect(matcher('file5.txt')).toBe(true);
    expect(matcher('filea.txt')).toBe(false);
  });

  test('negated character classes [!...]', () => {
    const matcher = toMatcher('file[!0-9].txt');
    expect(matcher('filea.txt')).toBe(true);
    expect(matcher('file_.txt')).toBe(true);
    expect(matcher('file5.txt')).toBe(false);
  });

  test('array of patterns (OR logic)', () => {
    const matcher = toMatcher(['*.js', '*.ts']);
    expect(matcher('test.js')).toBe(true);
    expect(matcher('test.ts')).toBe(true);
    expect(matcher('test.txt')).toBe(false);
  });

  test('array with multiple patterns', () => {
    const matcher = toMatcher(['src/**/*.ts', 'test/**/*.test.js']);
    expect(matcher('src/a/b.ts')).toBe(true);
    expect(matcher('test/unit.test.js')).toBe(true);
    expect(matcher('test/unit.js')).toBe(false);
    expect(matcher('lib/index.ts')).toBe(false);
  });

  test('regex string pattern with slashes', () => {
    const matcher = toMatcher('/^test.*\\.js$/');
    expect(matcher('test123.js')).toBe(true);
    expect(matcher('testFile.js')).toBe(true);
    expect(matcher('mytest.js')).toBe(false);
  });

  test('regex string pattern with flags', () => {
    const matcher = toMatcher('/TEST/i');
    expect(matcher('test')).toBe(true);
    expect(matcher('TEST')).toBe(true);
    expect(matcher('Test')).toBe(true);
    expect(matcher('testing')).toBe(true);
  });

  test('RegExp object', () => {
    const matcher = toMatcher(/\.tsx?$/);
    expect(matcher('file.ts')).toBe(true);
    expect(matcher('file.tsx')).toBe(true);
    expect(matcher('file.js')).toBe(false);
  });

  test('array with mixed types', () => {
    const matcher = toMatcher(['*.js', /\.tsx?$/, '/\\.json$/']);
    expect(matcher('test.js')).toBe(true);
    expect(matcher('component.tsx')).toBe(true);
    expect(matcher('config.json')).toBe(true);
    expect(matcher('style.css')).toBe(false);
  });

  test('complex glob patterns', () => {
    const matcher = toMatcher('**/*.[jt]s{,x}');
    expect(matcher('a.ts')).toBe(true);
    expect(matcher('a.tsx')).toBe(true);
    expect(matcher('a.js')).toBe(true);
    expect(matcher('dir/a/b.jsx')).toBe(true);
    expect(matcher('a.cs')).toBe(false);
  });

  test('empty array returns false', () => {
    const matcher = toMatcher([]);
    expect(matcher('anything.txt')).toBe(false);
    expect(matcher('')).toBe(false);
  });
});
