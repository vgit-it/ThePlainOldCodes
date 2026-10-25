# The Plain Old Codes

A browser app that writes and plays whole songs, and shows a pixel band (Plain Old Codes) playing them. Pick a genre, mood and seed and it writes a song: sections (intro, verse, chorus, bridge, solo, outro), chords, rhythm guitar, lead guitar and solos, bass, drums, and a sung demo vocal with words. Play it with sampled instruments and real guitar amps, watch the band play it on a stage, lock the parts you like and reroll the rest, share a song by link, and export it as MIDI, a mastered MP3 / WAV, stems, or a band video. Static site, no server, works on desktop and phone.

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints. `npm run build` makes a static build in `dist/`.

## Project layout

- `index.html`, `src/main.ts`: the song generator page
- `band.html`, `src/band/`: the band view (pixel band on a stage) and the video render
- `lick-lab.html`, `src/lab/lickLab.ts`: the lick lab (built, not linked)
- `src/generator.ts`: builds an idea (chords, strum, drums, bass) from options + seeds (pure and deterministic)
- `src/track.ts`: grows an idea into a song of sections (see `docs/TRACKS.md`)
- `src/parts/`: writers for every part: chords, strum, riff, drums, bass, guitar 2, solos, layers, vocal and words
- `src/players/`: the band plays it their way: drummer, bassist, guitarists, lead, hands
- `src/verse/`: the lead vocal's melody writer
- `src/audio/`: playback engine, mixer, samples, real amps, the demo singer
- `src/export/`: MIDI and audio export
- `src/ui/`: page cards and controls
- `src/theory/`, `src/rhythm/`, `src/realism/`: chords and scales, meters, numbers measured from real songs
- `scripts/`: check scripts (`npm run ...-check`) and tools
- `docs/`: start with `docs/README.md` (an index)
- `art/`, `public/band/`: band art sources and the packed sprites

## Sample credits

- Piano: [Salamander Grand Piano V3](https://github.com/sfzinstruments/SalamanderGrandPiano) by Alexander Holm, [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Acoustic guitar (Shinyguitar), electric guitar (Emilyguitar), bass (Black And Blue Basses) and drums (Big Rusty Drums): [Karoryfer Samples](https://github.com/sfzinstruments), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Strings and percussion: [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) by Versilian Studios, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Electric guitar speaker cabinets: Dauntless IR pack by resington (via github.com/fnpngn/IR), "free to share however you wish but is not for resale".

Samples were trimmed, mixed to mono and re-encoded. Details are in `public/samples/CREDITS.md`.

## Libraries

- [Tone.js](https://github.com/Tonejs/Tone.js) (MIT): audio engine.
- [@tonejs/midi](https://github.com/Tonejs/Midi) (MIT): MIDI export.
- [@breezystack/lamejs](https://github.com/breezystack/lamejs) (LGPL-3.0): MP3 encoding, a JavaScript port of [LAME](https://lame.sourceforge.io/). It's loaded unmodified as its own file (only when you export an MP3), so it can be swapped for another build.
- [fflate](https://github.com/101arrowz/fflate) (MIT): zipping stems.
- [klatt-syn](https://github.com/chdh/klatt-syn) by Christian d'Heureuse (MIT), with [dsp-collection](https://github.com/chdh/dsp-collection) (MIT): the Klatt formant synthesizer behind the demo singer.
