from pathlib import Path
import re
text = Path("doc/表结构信息.md").read_text(encoding="utf-8")
tables = re.findall(r"CREATE TABLE\s+(\w+)", text)
unique = []
for t in tables:
    if t not in unique:
        unique.append(t)
for t in unique:
    print(t)
