#!/usr/bin/env python3
"""Drive the built Skill Shelf CLI through a real Unix PTY; retain proof."""
import argparse
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pty
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time

REPO = Path(__file__).resolve().parents[4]
NODE = shutil.which('node')
FEATURES = ('project', 'global', 'details', 'terminal', 'cli')


def doctor():
    if not NODE:
        raise RuntimeError('Node.js 20+ is required')
    version = subprocess.check_output([NODE, '--version'], text=True).strip()
    if int(version.lstrip('v').split('.')[0]) < 20:
        raise RuntimeError('Node.js 20+ is required')
    cli = REPO / 'dist/cli.js'
    if not cli.exists():
        raise RuntimeError('Run npm ci (if needed), then npm run build')
    sources = list((REPO / 'src').glob('*')) + [REPO / 'package.json']
    if max(p.stat().st_mtime for p in sources) > cli.stat().st_mtime:
        raise RuntimeError('Build is stale: run npm run build')
    actual = subprocess.check_output([NODE, str(cli), '--version'], text=True).strip()
    expected = json.loads((REPO / 'package.json').read_text())['version']
    if actual != expected:
        raise RuntimeError(f'Wrong CLI version: {actual}, expected {expected}')
    return {'node': version, 'node_path': NODE, 'cli': str(cli),
            'version': actual, 'cli_sha256': hashlib.sha256(cli.read_bytes()).hexdigest()}


def seed(home):
    parent = home / 'workspace'
    project = parent / 'project'
    for base, names in ((project, ('alpha', 'beta', 'charlie', 'delta')),
                        (parent, ('parent-only',)), (home, ('global-only',))):
        for name in names:
            folder = base / '.agents/skills' / name
            folder.mkdir(parents=True)
            (folder / 'SKILL.md').write_text(f'---\nname: {name}\n---\n{name}\n')
    (project / 'skills-lock.json').write_text(json.dumps({
        'version': 1, 'skills': {name: {'source': source} for name, source in
                               [('alpha', 'repo/a'), ('beta', 'repo/a'),
                                ('charlie', 'repo/b'), ('delta', 'repo/b')]}}))
    (home / '.agents/.skill-lock.json').write_text(json.dumps({
        'version': 3, 'skills': {'global-only': {'source': 'repo/global',
                                               'sourceType': 'github'}}}))
    return project


def inventory(home):
    result = {}
    for path in sorted(home.rglob('*')):
        name = str(path.relative_to(home))
        result[name] = ('dir' if path.is_dir() else
                        hashlib.sha256(path.read_bytes()).hexdigest())
    return result


def step(wait, keys=None, size=None):
    return dict(wait=wait, keys=keys, size=size)


def journey(name):
    ready = step(['Project  ·  5 installed', 'Enter details', 'parent-only'])
    quit_step = step(['\x1b[?1049l'], 'q')
    if name == 'project':
        return [ready, step(['Installed locations', 'alpha', 'repo/a'], '\r'),
                step(['Installed locations', 'beta'], 'l'),
                step(['Installed locations', 'alpha'], 'h'),
                step(['Enter details'], '\x1b'),
                step(['\x1b[4mcharlie'], 'j'), step(['\x1b[4malpha'], 'k'),
                step(['\x1b[4mbeta'], '\x1b[C'),
                step(['\x1b[4malpha'], '\x1b[D'), quit_step]
    if name == 'global':
        return [ready, step(['Global  ·  1 installed', 'global-only'], '\t'),
                step(['Installed locations', 'global-only', 'Agents'], '\r'),
                step(['Project  ·  5 installed', 'alpha'], '\t'), quit_step]
    if name == 'details':
        return [ready, step(['Source', 'repo/a', 'Installed locations',
                             'Agents', '.agents/skills/alpha'], '\r'),
                step(['Installed locations', 'beta'], '\x1b[C'),
                step(['Installed locations', 'alpha'], '\x1b[D'),
                step(['Enter details'], '\r'),
                step(['Installed locations'], '\r'),
                step(['Enter details'], '\x1b'), quit_step]
    if name == 'terminal':
        return [ready, step(['Installed locations'], '\r'),
                step(['Esc back · ↑↓ · q quit'], size=[30, 12]),
                step(['Esc back · ↑↓ · q quit'], 'j'),
                step(['Source'], 'k'), step(['Tab · hjkl · Enter · q'], '\x1b'),
                step(['Enter details'], size=[120, 38]),
                step(['\x1b[?1049l'], '\x03')]
    raise ValueError(name)


def drive(name, home, project, env, evidence):
    steps = journey(name)
    (evidence / f'{name}.actions.json').write_text(json.dumps(steps, indent=2))
    transcript = bytearray()
    events = []
    pid, terminal = pty.fork()
    if pid == 0:
        os.chdir(project)
        os.execve(NODE, [NODE, str(REPO / 'dist/cli.js')], env)
    try:
        fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
        for index, action in enumerate(steps):
            if action['size']:
                cols, rows = action['size']
                fcntl.ioctl(terminal, termios.TIOCSWINSZ,
                            struct.pack('HHHH', rows, cols, 0, 0))
                os.kill(pid, signal.SIGWINCH)
            if action['keys'] is not None:
                os.write(terminal, action['keys'].encode())
            received = bytearray()
            deadline = time.monotonic() + 8
            while True:
                raw = not (termios.tcgetattr(terminal)[3] & termios.ICANON)
                if all(text.encode() in received for text in action['wait']) and (index or raw):
                    break
                if time.monotonic() > deadline:
                    raise RuntimeError(f'{name} step {index}: missing {action["wait"]!r}')
                if not select.select([terminal], [], [], 0.05)[0]:
                    continue
                try:
                    chunk = os.read(terminal, 65536)
                except OSError as error:
                    if error.errno == errno.EIO:
                        raise RuntimeError(f'{name} exited at step {index}') from error
                    raise
                if not chunk:
                    raise RuntimeError(f'{name} exited at step {index}')
                received.extend(chunk)
                transcript.extend(chunk)
            events.append({'step': index, 'action': action,
                           'observed': received.decode(errors='replace')})
        deadline = time.monotonic() + 8
        while True:
            exited, status = os.waitpid(pid, os.WNOHANG)
            if exited:
                pid = None
                if os.waitstatus_to_exitcode(status) != 0:
                    raise RuntimeError(f'{name}: nonzero exit {status}')
                break
            if time.monotonic() > deadline:
                raise RuntimeError(f'{name}: failed to quit')
            select.select([], [], [], 0.05)
        for marker in (b'\x1b[?1049h', b'\x1b[?25h', b'\x1b[?1049l'):
            if marker not in transcript:
                raise RuntimeError(f'{name}: missing terminal lifecycle marker {marker!r}')
    finally:
        if pid is not None:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            os.waitpid(pid, 0)
        os.close(terminal)
        (evidence / f'{name}.ansi').write_bytes(transcript)
        (evidence / f'{name}.events.json').write_text(json.dumps(events, indent=2))


def cli_checks(env, project, evidence):
    results = []
    for args, code, text in [(['--help'], 0, 'Usage: skill-shelf'),
                             (['--version'], 0, doctor()['version']),
                             ([], 1, 'requires an interactive terminal'),
                             (['--invalid'], 2, 'Usage: skill-shelf')]:
        run = subprocess.run([NODE, str(REPO / 'dist/cli.js'), *args],
                             cwd=project, env=env, capture_output=True, text=True, timeout=10)
        results.append(dict(args=args, exit=run.returncode, stdout=run.stdout, stderr=run.stderr))
        (evidence / 'cli.json').write_text(json.dumps(results, indent=2))
        if run.returncode != code or text not in run.stdout + run.stderr or '\x1b[?1049h' in run.stdout:
            raise RuntimeError(f'CLI contract failed: {args}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('feature', choices=('doctor', 'all', *FEATURES))
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    health = doctor()
    if args.feature == 'doctor':
        print(json.dumps(health, indent=2))
        return
    evidence = (args.evidence or Path(tempfile.mkdtemp(prefix='skill-shelf-proof-'))).resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    if any(evidence.iterdir()):
        raise RuntimeError('Use a new, empty evidence directory to preserve earlier proofs')
    report = dict(doctor=health, passed=[], status='running', evidence=str(evidence))
    scratch = Path(tempfile.mkdtemp(prefix='skill-shelf-fixture-')).resolve()
    before = {}
    try:
        home = scratch / 'home'
        project = seed(home)
        env = {'PATH': os.environ.get('PATH', ''), 'HOME': str(home),
               'TERM': 'xterm-256color', 'XDG_CONFIG_HOME': str(home / '.config'),
               'XDG_STATE_HOME': str(home / '.local/state')}
        before = inventory(home)
        (evidence / 'before.json').write_text(json.dumps(before, indent=2))
        report.update(home=str(home), cwd=str(project))
        for feature in FEATURES if args.feature == 'all' else (args.feature,):
            if feature == 'cli':
                cli_checks(env, project, evidence)
            else:
                drive(feature, home, project, env, evidence)
            report['passed'].append(feature)
        report['status'] = 'passed'
    except Exception as error:
        report.update(status='failed', error=str(error))
        raise
    finally:
        after = inventory(scratch / 'home')
        (evidence / 'after.json').write_text(json.dumps(after, indent=2))
        unchanged = before == after
        report['fixture_unchanged'] = unchanged
        shutil.rmtree(scratch)
        report['scratch_removed'] = not scratch.exists()
        if not unchanged:
            report.update(status='failed', error='Browsing changed fixture files or directories')
        (evidence / 'report.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2))
    if report['status'] != 'passed':
        raise RuntimeError(report['error'])


if __name__ == '__main__':
    main()
