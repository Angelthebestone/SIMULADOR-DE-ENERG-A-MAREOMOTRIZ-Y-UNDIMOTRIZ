# Fuentes empaquetadas

Coloca aquí estos cinco archivos (todos con licencia SIL OFL 1.1, uso libre):

| Archivo | Origen |
|---|---|
| `IBMPlexSans-Regular.woff2` | https://github.com/IBM/plex/releases (carpeta `IBM-Plex-Sans/fonts/complete/woff2/`) |
| `IBMPlexSans-SemiBold.woff2` | ídem |
| `IBMPlexSans-Bold.woff2` | ídem |
| `IBMPlexMono-Regular.woff2` | ídem (`IBM-Plex-Mono/fonts/complete/woff2/`) |
| `BricolageGrotesque-Variable.woff2` | https://github.com/ateliertriay/bricolage/releases (`fonts/variable/`) — renombrar el `.woff2` variable |

Alternativa rápida: descargar la familia desde Google Fonts, convertir los
`.ttf` a `.woff2` con `pip install fonttools brotli && pyftsubset archivo.ttf --flavor=woff2 --output-file=archivo.woff2 --unicodes="U+0000-00FF,U+0100-017F,U+2000-206F,U+20A0-20CF,U+2190-21FF"`.

Vite los copia a `dist/assets/` con hash; la CSP `font-src 'self'` ya lo permite.
Si falta alguno, tokens.css recae en Segoe UI / system-ui sin romper nada.
