"""Append i18n keys to ru/en/tr dictionaries. Usage: python3 scripts/addkeys.py keys.json
keys.json: {"key": ["ru", "en", "tr"], ...}"""
import json, sys, re
keys = json.load(open(sys.argv[1]))
for i, lang in enumerate(['ru', 'en', 'tr']):
    p = f'src/i18n/{lang}.ts'
    s = open(p).read()
    idx = s.rstrip().rfind('};')
    lines = ''
    for k, v in keys.items():
        if f"'{k}':" in s:
            # replace existing value
            s = re.sub(r"  '" + re.escape(k) + r"': .*?,\n", lambda m: f"  '{k}': {json.dumps(v[i], ensure_ascii=False)},\n", s, count=1)
            continue
        lines += f"  '{k}': {json.dumps(v[i], ensure_ascii=False)},\n"
    idx = s.rstrip().rfind('};')
    s = s[:idx] + lines + s[idx:]
    open(p, 'w').write(s)
print('ok', len(keys))
