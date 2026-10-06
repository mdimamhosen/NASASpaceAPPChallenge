# 4:00 video pipeline

Regenerates `docs/video/team/binary-explorers-mars-explorer.mp4` (exactly 240.000 s, 1080p30) and its `.srt`.

Structure follows WHO → WHY → WHAT → HOW (`script.json` → `chapters`). Run from this folder, with the app running (`pnpm dev`; blank `NEXT_PUBLIC_GOOGLE_MAP_API_KEY` if the browser key is not allowed on localhost):

```sh
mkdir -p photos && cp ../../../data/Images/*.jpeg photos/
GEMINI_API_KEY=… node tts.mjs           # voice per scene (Gemini TTS, voice + tempo in script.json)
node broll.mjs                          # records verified 1080p clips from the live app (opens Chrome)
node render.mjs timeline                # solves scene timing to exactly 240 s
node audio.mjs                          # ducked ambient pad + voice + swells → audio/final.wav
node render.mjs full                    # renders 7,200 frames through compositor.html
node finish.mjs ../team                 # MP4 (thumbnail intro + cover art) + SRT
```

Generated folders (`vo/`, `clips/`, `frames/`, `audio/`, `photos/`, `chrome-*`) are not committed.
