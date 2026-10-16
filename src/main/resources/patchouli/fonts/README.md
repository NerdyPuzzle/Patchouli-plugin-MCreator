The editor uses Minecraft 1.21.1's font assets, downloaded from Mojang's version manifest and asset service.

`guidebook-uniform.woff` and `guidebook-uniform-upper.woff` contain the glyphs from `minecraft/font/unifont.zip` (GNU Unifont 15.1.05, asset SHA-1 `666999116c467f10622db1527a06ddc0a6efad2a`). Patchouli selects `minecraft:uniform` when `use_blocky_font` is false. These fonts retain Minecraft's trimmed glyph widths, half-pixel outlines, size overrides, and space advances. The accompanying `UNIFONT-LICENSE.txt` applies to these derived fonts.

`guidebook-minecraft.woff` contains the default font's bitmap providers, in their original priority order: `nonlatin_european.png`, `accented.png`, and `ascii.png`. The assets come from the official 1.21.1 client. Glyph outlines, ascents, and advances follow the bitmap provider definitions. These Minecraft assets belong to Mojang Studios. The uniform font supplies glyphs absent from the bitmap providers, as it does in Minecraft.

Sources:

- https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
- https://resources.download.minecraft.net/66/666999116c467f10622db1527a06ddc0a6efad2a
- https://unifoundry.com/unifont/index.html