#!/usr/bin/env bash
# Optimize hero videos for web: VP9 WebM (primary) + H.264 MP4 (Safari fallback), 24fps, no audio, + poster JPGs.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=public/hero
OUT=public/hero/web
mkdir -p "$OUT"
FF="C:/Users/MyHomehP/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe"
F=( -hide_banner -loglevel error -y )

# name, input, scaleW:scaleH, vp9 crf, h264 crf
convert () {
  local name=$1 src=$2 sc=$3 vcrf=$4 hcrf=$5
  echo "== $name"
  # VP9 / WebM
  "$FF" "${F[@]}" -i "$src" -vf "scale=${sc%:*}:${sc#*:}:flags=lanczos,fps=24" \
    -c:v libvpx-vp9 -crf "$vcrf" -b:v 0 -row-mt 1 -cpu-used 4 -an \
    "$OUT/$name.webm"
  # H.264 / MP4 fallback
  "$FF" "${F[@]}" -i "$src" -vf "scale=${sc%:*}:${sc#*:}:flags=lanczos,fps=24" \
    -c:v libx264 -crf "$hcrf" -preset slower -movflags +faststart -pix_fmt yuv420p -an \
    "$OUT/$name.mp4"
  # Poster (frame at 1s)
  "$FF" "${F[@]}" -ss 1 -i "$src" -vf "scale=${sc%:*}:${sc#*:}:flags=lanczos" -frames:v 1 -q:v 5 "$OUT/$name.jpg"
  ls -la "$OUT" | grep "$name"
}

convert hero-mobile  "$IN/hanutek-commercial-mobile-2x1-hero.mp4"  960:480   30 30
convert hero-tablet  "$IN/hanutek-commercial-tablet-2x1-hero.mp4" 1440:720   31 31
convert hero-desktop "$IN/hanutek-commercial-happyhorse-30s.mp4"  1600:900   33 32
echo DONE
ls -la "$OUT"
