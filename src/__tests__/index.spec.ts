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

  test('nocase option - case insensitive matching', () => {
    const re = toRegex('src/**/*.TXT', {nocase: true});
    expect(re.test('src/file.txt')).toBe(true);
    expect(re.test('src/file.TXT')).toBe(true);
    expect(re.test('src/file.Txt')).toBe(true);
    expect(re.test('src/a/b/FILE.txt')).toBe(true);
    expect(re.test('src/a/b/FILE.TXT')).toBe(true);
  });

  test('nocase option disabled - case sensitive (default)', () => {
    const re = toRegex('src/**/*.txt');
    expect(re.test('src/file.txt')).toBe(true);
    expect(re.test('src/file.TXT')).toBe(false);
    expect(re.test('src/file.Txt')).toBe(false);
  });

  test('nocase with braces', () => {
    const re = toRegex('*.{HTML,TXT}', {nocase: true});
    expect(re.test('file.html')).toBe(true);
    expect(re.test('file.HTML')).toBe(true);
    expect(re.test('file.txt')).toBe(true);
    expect(re.test('file.TXT')).toBe(true);
    expect(re.test('file.Html')).toBe(true);
  });

  describe('Extended Globbing (extglob)', () => {
    test('?(pattern) - zero or one occurrence', () => {
      const re = toRegex('file?(s).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(true);
      expect(re.test('files.txt')).toBe(true);
      expect(re.test('filess.txt')).toBe(false);
    });

    test('*(pattern) - zero or more occurrences', () => {
      const re = toRegex('file*(.bak).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(true);
      expect(re.test('file.bak.txt')).toBe(true);
      expect(re.test('file.bak.bak.txt')).toBe(true);
      expect(re.test('file.bak.bak.bak.txt')).toBe(true);
    });

    test('+(pattern) - one or more occurrences', () => {
      const re = toRegex('file+(.bak).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(false);
      expect(re.test('file.bak.txt')).toBe(true);
      expect(re.test('file.bak.bak.txt')).toBe(true);
    });

    test('@(pattern) - exactly one occurrence', () => {
      const re = toRegex('file.@(jpg|png|gif)', {extglob: true});
      expect(re.test('file.jpg')).toBe(true);
      expect(re.test('file.png')).toBe(true);
      expect(re.test('file.gif')).toBe(true);
      expect(re.test('file.bmp')).toBe(false);
      expect(re.test('file.jpgjpg')).toBe(false);
    });

    test('!(pattern) - match anything except the pattern', () => {
      const re = toRegex('!(*.txt)', {extglob: true});
      expect(re.test('file.js')).toBe(true);
      expect(re.test('file.md')).toBe(true);
      expect(re.test('file.txt')).toBe(false);
      expect(re.test('test.txt')).toBe(false);
    });

    test('!(pattern) - example from requirements: /var/log/!(*.gz)', () => {
      const re = toRegex('/var/log/!(*.gz)', {extglob: true});
      expect(re.test('/var/log/syslog')).toBe(true);
      expect(re.test('/var/log/messages')).toBe(true);
      expect(re.test('/var/log/kern.log')).toBe(true);
      expect(re.test('/var/log/error.log.gz')).toBe(false);
      expect(re.test('/var/log/access.gz')).toBe(false);
    });

    test('?(pattern-list) with multiple alternatives', () => {
      const re = toRegex('file?(a|b|c).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(true);
      expect(re.test('filea.txt')).toBe(true);
      expect(re.test('fileb.txt')).toBe(true);
      expect(re.test('filec.txt')).toBe(true);
      expect(re.test('filed.txt')).toBe(false);
      expect(re.test('fileab.txt')).toBe(false);
    });

    test('*(pattern-list) with multiple alternatives', () => {
      const re = toRegex('file*(a|b).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(true);
      expect(re.test('filea.txt')).toBe(true);
      expect(re.test('fileb.txt')).toBe(true);
      expect(re.test('fileaa.txt')).toBe(true);
      expect(re.test('fileab.txt')).toBe(true);
      expect(re.test('fileba.txt')).toBe(true);
      expect(re.test('fileaaa.txt')).toBe(true);
      expect(re.test('filec.txt')).toBe(false);
    });

    test('+(pattern-list) with multiple alternatives', () => {
      const re = toRegex('file+(x|y).txt', {extglob: true});
      expect(re.test('file.txt')).toBe(false);
      expect(re.test('filex.txt')).toBe(true);
      expect(re.test('filey.txt')).toBe(true);
      expect(re.test('filexy.txt')).toBe(true);
      expect(re.test('filexx.txt')).toBe(true);
      expect(re.test('fileyy.txt')).toBe(true);
      expect(re.test('filexyz.txt')).toBe(false);
    });

    test('@(pattern-list) with multiple alternatives', () => {
      const re = toRegex('@(test|spec|demo).js', {extglob: true});
      expect(re.test('test.js')).toBe(true);
      expect(re.test('spec.js')).toBe(true);
      expect(re.test('demo.js')).toBe(true);
      expect(re.test('unit.js')).toBe(false);
      expect(re.test('testspec.js')).toBe(false);
    });

    test('!(pattern-list) with multiple alternatives', () => {
      const re = toRegex('!(test|tmp)/*', {extglob: true});
      expect(re.test('src/file.js')).toBe(true);
      expect(re.test('lib/index.ts')).toBe(true);
      expect(re.test('test/spec.js')).toBe(false);
      expect(re.test('tmp/cache.dat')).toBe(false);
    });

    test('extglob with wildcards inside pattern', () => {
      const re = toRegex('*(*.js|*.ts)', {extglob: true});
      expect(re.test('')).toBe(true);
      expect(re.test('file.js')).toBe(true);
      expect(re.test('file.ts')).toBe(true);
      expect(re.test('file.jsfile.ts')).toBe(true);
    });

    test('extglob combined with ** globstar', () => {
      const re = toRegex('src/**/!(*.test).js', {extglob: true});
      expect(re.test('src/index.js')).toBe(true);
      expect(re.test('src/utils/helper.js')).toBe(true);
      expect(re.test('src/app.test.js')).toBe(false);
      expect(re.test('src/utils/func.test.js')).toBe(false);
    });

    test('extglob with character classes', () => {
      const re = toRegex('file@([0-9]|[a-z]).txt', {extglob: true});
      expect(re.test('file0.txt')).toBe(true);
      expect(re.test('file5.txt')).toBe(true);
      expect(re.test('filea.txt')).toBe(true);
      expect(re.test('filez.txt')).toBe(true);
      expect(re.test('fileA.txt')).toBe(false);
      expect(re.test('file10.txt')).toBe(false);
    });

    test('multiple extglobs in one pattern', () => {
      const re = toRegex('?(pre_)test+(1|2|3).@(js|ts)', {extglob: true});
      expect(re.test('test1.js')).toBe(true);
      expect(re.test('pre_test1.js')).toBe(true);
      expect(re.test('test123.ts')).toBe(true);
      expect(re.test('pre_test2.ts')).toBe(true);
      expect(re.test('test.js')).toBe(false);
      expect(re.test('pre_test1.txt')).toBe(false);
    });

    test('extglob disabled by default - treats as literal', () => {
      const re = toRegex('file?(a|b).txt');
      // Without extglob, ?(a|b) should be treated as literal characters
      expect(re.test('file?(a|b).txt')).toBe(true);
      expect(re.test('filea.txt')).toBe(false);
    });

    test('extglob with braces', () => {
      const re = toRegex('file@(a|b).{js,ts}', {extglob: true});
      expect(re.test('filea.js')).toBe(true);
      expect(re.test('fileb.js')).toBe(true);
      expect(re.test('filea.ts')).toBe(true);
      expect(re.test('fileb.ts')).toBe(true);
      expect(re.test('filec.js')).toBe(false);
      expect(re.test('filea.txt')).toBe(false);
    });

    test('nested extglob patterns', () => {
      const re = toRegex('*(a|+(b|c))', {extglob: true});
      expect(re.test('')).toBe(true);
      expect(re.test('a')).toBe(true);
      expect(re.test('b')).toBe(true);
      expect(re.test('c')).toBe(true);
      expect(re.test('bb')).toBe(true);
      expect(re.test('abc')).toBe(true);
      expect(re.test('abcbc')).toBe(true);
    });

    test('extglob with nocase option', () => {
      const re = toRegex('file@(test|DEMO).txt', {extglob: true, nocase: true});
      expect(re.test('filetest.txt')).toBe(true);
      expect(re.test('fileTEST.txt')).toBe(true);
      expect(re.test('filedemo.txt')).toBe(true);
      expect(re.test('fileDEMO.txt')).toBe(true);
      expect(re.test('fileTest.txt')).toBe(true);
    });

    test('when extglob paren not closed', () => {
      const re = toRegex('file@(test.txt', {extglob: true});
      expect(re.test('file@(test.txt')).toBe(true);
      expect(re.test('filetest.txt')).toBe(false);
      const re2 = toRegex('file@(test|DEMO.txt', {extglob: true});
      expect(re2.test('file@(test|DEMO.txt')).toBe(true);
      expect(re2.test('file@(test|DEMO2.txt')).toBe(false);
    });
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

  test('nocase option - case insensitive matching', () => {
    const matcher = toMatcher('src/**/*.TXT', {nocase: true});
    expect(matcher('src/file.txt')).toBe(true);
    expect(matcher('src/file.TXT')).toBe(true);
    expect(matcher('src/file.Txt')).toBe(true);
    expect(matcher('src/a/b/FILE.txt')).toBe(true);
  });

  test('nocase with array patterns', () => {
    const matcher = toMatcher(['*.JS', '*.TS'], {nocase: true});
    expect(matcher('test.js')).toBe(true);
    expect(matcher('test.JS')).toBe(true);
    expect(matcher('test.ts')).toBe(true);
    expect(matcher('test.TS')).toBe(true);
    expect(matcher('test.Js')).toBe(true);
  });
});
