set -eu
umask 022
mkdir -p .config/linear
umask 077
printf 'pilot-test-token\n' > .config/linear/token
umask 022
