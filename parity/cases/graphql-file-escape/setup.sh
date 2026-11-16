set -eu
umask 022
printf 'query { viewer { id } }\n' > ../outside-query.graphql
ln -s ../outside-query.graphql escape.graphql
