set -eu
umask 022
mkdir -p '.'
printf %s 'team_id = 42
' > '.linear.toml'
