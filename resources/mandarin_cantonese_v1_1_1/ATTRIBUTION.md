# Attribution and licensing

## CC-Canto

This package includes adapted headword, traditional-form and Jyutping information selected from **CC-Canto, version 2017-02-02**. Candidate source headwords were restricted to entries also present in the CEDICT Mandarin dictionary mirror dated 2007-08-25.

- Project: https://github.com/amadeusine/cc-canto-data
- Copyright: Pleco Software Incorporated / Pleco Inc., as stated by the source project
- License: Creative Commons Attribution-ShareAlike 3.0 Unported
- License text: https://creativecommons.org/licenses/by-sa/3.0/

The adapted rows are identified by the provenance value `CC-Canto 2017-02-02 + CEDICT headword filter; CC BY-SA 3.0`.

## CEDICT headword filter

- Mirror used: https://github.com/jtoy/crdict/blob/master/cedict_ts.u8
- Snapshot header date: 2007-08-25
- Use in this build: Mandarin-headword membership filter only

## Original and generated material

The v0.1 curated seed rows and controlled-generation frames were prepared for this project. Because they are distributed together with adapted CC-Canto material, this combined data package is released under CC BY-SA 3.0.

## Quality notice

CC-Canto is used here to generate same-lexeme fallback candidates, not to assert that every selected word is the preferred colloquial Hong Kong Cantonese translation in every context. Rows marked `auto_sourced_candidate` require editorial review.


## v1.1.0 normalization change

Pure same-lexeme rows for which OpenCC `s2t(source)` exactly equals the target were removed.
The remaining package still contains adapted CC-Canto entries and therefore retains the CC BY-SA 3.0 package license.


## v1.1.1 cleaning
Removed remaining same-lexeme script/variant passthrough rows using bidirectional OpenCC normalization.
