#!/bin/sh
# Sets up lbw-kit for Landbot colleagues: the public library and the private docs repo in ONE folder,
# the way they're developed (the library is .git, the docs/tools/examples are .private.git).
# Needs read access to github.com/pausanchez/lbw-kit-docs (private). Usage: sh setup-landbot.sh [folder]
set -e
DIR="${1:-lbw-kit}"
if [ -e "$DIR" ]; then echo "✖ $DIR already exists: choose another folder name"; exit 1; fi
git clone https://github.com/pausanchez/lbw-kit.git "$DIR"
cd "$DIR"
git clone --bare https://github.com/pausanchez/lbw-kit-docs.git .private.git
git --git-dir=.private.git --work-tree=. config core.bare false
git --git-dir=.private.git --work-tree=. config status.showUntrackedFiles no
git --git-dir=.private.git --work-tree=. checkout -f main
echo "✔ lbw-kit ready in $DIR. Next: cd $DIR && npm install && npm run check, then read START-HERE.md"
