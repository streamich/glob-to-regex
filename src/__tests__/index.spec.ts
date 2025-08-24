import {describe, test, expect} from 'vitest';
import {toRegex} from '..';

describe('fs-tools/glob.toRegex', () => {
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
