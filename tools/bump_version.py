#!/usr/bin/env python3
"""Bump the app version everywhere it lives (js/version.js, version.json, sw.js).

Usage:  python3 tools/bump_version.py 1.1.0
The build number auto-increments; clients poll version.json and self-update
when the build rises.
"""
import json
import re
import sys
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'\d+\.\d+\.\d+(-\w+)?', sys.argv[1]):
        sys.exit('usage: bump_version.py <semver, e.g. 1.1.0 or 0.2.0-alpha>')
    version = sys.argv[1]

    vj_path = os.path.join(ROOT, 'version.json')
    with open(vj_path) as f:
        build = json.load(f)['build'] + 1
    with open(vj_path, 'w') as f:
        json.dump({'version': version, 'build': build}, f)
        f.write('\n')

    js_path = os.path.join(ROOT, 'js', 'version.js')
    with open(js_path) as f:
        src = f.read()
    src = re.sub(r"VERSION = '[^']*'", f"VERSION = '{version}'", src)
    src = re.sub(r'BUILD = \d+', f'BUILD = {build}', src)
    with open(js_path, 'w') as f:
        f.write(src)

    sw_path = os.path.join(ROOT, 'sw.js')
    with open(sw_path) as f:
        src = f.read()
    src = re.sub(r"const VERSION = '[^']*'", f"const VERSION = '{version}'", src)
    with open(sw_path, 'w') as f:
        f.write(src)

    print(f'bumped to v{version} (build {build})')


if __name__ == '__main__':
    main()
