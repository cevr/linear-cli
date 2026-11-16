set -eu
umask 022
mkdir -p '.'
printf %s 'team_id = "E\u004eG" # default
' > '.linear.toml'
