set -eu
umask 022
mkdir -p '.'
printf %s 'query { viewer { id name } }
' > 'query.graphql'
