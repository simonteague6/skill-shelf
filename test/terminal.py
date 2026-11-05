"""Drive the actual CLI through a controlling Unix PTY."""
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import time

steps = json.load(sys.stdin)
pid, terminal = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])

transcript = bytearray()
try:
    fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))
    for index, step in enumerate(steps):
        if 'size' in step:
            cols, rows = step['size']
            fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack('HHHH', rows, cols, 0, 0))
            os.kill(pid, signal.SIGWINCH)
        if 'keys' in step:
            os.write(terminal, step['keys'].encode())
        received = bytearray()
        deadline = time.monotonic() + 8
        while True:
            ready = step.get('wait', '').encode() in received
            raw = not (termios.tcgetattr(terminal)[3] & termios.ICANON)
            if ready and (index > 0 or raw):
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError('Missing terminal output at step ' + str(index) + ': ' + step['wait'])
            # Passive input effects enable raw mode after the first frame.
            if not select.select([terminal], [], [], min(0.05, remaining))[0]:
                continue
            try:
                chunk = os.read(terminal, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    raise RuntimeError('CLI exited before step ' + str(index)) from error
                raise
            if not chunk:
                raise RuntimeError('CLI exited before step ' + str(index))
            transcript.extend(chunk)
            received.extend(chunk)
    _, status = os.waitpid(pid, 0)
    pid = None
    if os.waitstatus_to_exitcode(status) != 0:
        raise RuntimeError('CLI did not exit successfully')
finally:
    os.close(terminal)
    if pid is not None:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        os.waitpid(pid, 0)
    sys.stdout.buffer.write(transcript)
