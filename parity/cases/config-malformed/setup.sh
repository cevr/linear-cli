set -eu
umask 022
mkdir -p '.'
printf %s 'team_id = "unterminated' > '.linear.toml'
