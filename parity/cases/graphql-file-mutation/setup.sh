set -eu
umask 022
mkdir -p '.'
printf %s 'mutation { issueArchive(id: "ENG-123") { success } }
' > 'mutation.graphql'
