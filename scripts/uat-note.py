#!/usr/bin/env python3
"""Append local UAT evidence and refresh the handoff status (no external writes)."""
import datetime, json, pathlib, sys
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).strftime('%Y-%m-%d %H:%M')
p = pathlib.Path('docs/uat/UAT-RESULTS.md')
with p.open('a') as f:
    f.write(f'\n- {now}：{sys.argv[1]}\n')
s = pathlib.Path('docs/uat/UAT-STATUS.json')
data = json.loads(s.read_text())
data.update(updated=now, notes=sys.argv[1])
s.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
