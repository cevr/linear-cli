"""Pass exact non-NUL argv bytes to either control via execve (POSIX only).

JS child_process only takes strings and encodes them as UTF-8. This test adapter
does not decode or repair the bytes: each CLI must perform its own decoding.
"""
import os
import sys

command = os.fsencode(sys.argv[1])
os.execve(command, [command, *(bytes.fromhex(arg) for arg in sys.argv[2:])], os.environ)
