#!/bin/sh
# Publica web/ en la rama gh-pages (GitHub Pages). Ejecutar tras regenerar web/data.js y hacer commit en main.
set -e
cd "$(dirname "$0")/.."
git push origin main
git subtree split --prefix web -b gh-pages
git push -f origin gh-pages
git branch -D gh-pages
echo "Publicado: https://edelahozuah.github.io/HorariosEPS/"
