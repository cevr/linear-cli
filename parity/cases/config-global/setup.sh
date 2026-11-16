set -eu
umask 022
mkdir -p '.config/linear'
printf %s 'team_id = "ENG"
' > '.config/linear/config.toml'
