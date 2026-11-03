# Launcher artwork

`ui/thanos.png` is the Thanos / Infinity Gauntlet image supplied by the repository owner for the launcher. It is copied unchanged from the supplied attachment; cropping and contrast overlays are applied only by the UI stylesheet. It replaces the generated island artwork in the home and Setup screens. No image-generation tool was used for this replacement.

## Season 4 redesign

The owner requested Season 4 images from the internet. These bundled images are loaded locally (the renderer does not contact image hosts):

- `ui/art/season4-showdown.jpg`: Carbide/Omega Season 4 promotional artwork, [PC Gamer article](https://www.pcgamer.com/this-player-made-fortnite-superhero-film-is-awesome/), [original image](https://cdn.mos.cms.futurecdn.net/MHv37SVffvjJeCrokbtArD.jpg).
- `ui/art/season4.jpg`: Season 4 thumbnail, [Xbox Wire, May 1, 2018](https://news.xbox.com/en-us/2018/05/01/fortnite-season-4-starts-now-xbox-one/), [original image](https://xboxwire.thesourcemediaassets.com/sites/2/Fortnite_Season4_Thumb-small.jpg).
- `ui/art/hop-rocks.jpg`: Hop Rocks promotional artwork from the same Xbox Wire article, [original image](https://xboxwire.thesourcemediaassets.com/sites/2/BR04_Social_HopRocks.jpg).
- `ui/art/thanos-gauntlet.jpg`: original Fortnite × Avengers Infinity Gauntlet promotional artwork with Omega and Thanos, used for the ordinary Thanos mode. [Epic Games announcement](https://www.fortnite.com/news/infinity-gauntlet?lang=en-US), [original image](https://cdn2.unrealengine.com/Fortnite%2FEN_BR04_Social_InfinityGauntletLTM-1000x1000-de9fc2264b73dc191be2435b3e80bdff4bbdfc8a.jpg). Separate from the Infinity Showdown artwork.

Fortnite artwork belongs to its respective rights holders; these sources are attribution, not a claim of a new redistribution license. Images are stored unchanged and cropped using CSS.

## NOVA DROP identity

`ui/nova-drop.png` is the teal orbit and star emblem supplied by the repository owner on November 3, 2026. The 1254 × 1254 transparent PNG is copied unchanged from the attachment and used in the sidebar and startup screen. `scripts/create-icon.mjs` copies it into the build resources; electron-builder converts it to the Windows icon. No image-generation tool was used for this replacement. Source SHA-256: `00af8064ff12420a511ab0c7d3d34d8d2d4d05d8d9ccf3f02fb5f973149b9229`.

`docs/thanos-dancing.gif` is the owner's supplied animation, optimized for the GitHub README to 360 × 202 pixels at 8 frames per second, retaining its approximately 75-second duration and watermark. It replaces the standalone logo in the README.

The previous meteor emblem was generated on November 1, 2026 and is retained in Git history. Its original generation prompt is recorded below. The older `ui/logo.svg` remains an unused legacy asset.

Generation prompt:

> Use case: logo-brand. Create a polished original emblem for NOVA DROP, a private Fortnite Chapter 1 Season 4 (version 4.2) launcher. Asset type: square desktop app icon and launcher brand mark. A bold angular meteor descending diagonally from upper right to lower left, its sculpted comet trail forming a subtle N silhouette, with a small four-point cosmic spark carved into the meteor head. Fortnite Season 4 inspired stylized game art: confident chunky silhouette, crisp beveled facets, luminous icy cyan edges, vivid electric violet core, a restrained warm golden impact accent. Premium and energetic, readable at 32 pixels, balanced centered composition, ample clear margin around the complete emblem. Transparent background, real alpha, clean isolated shape, no square backdrop, no environment, no mockup, no text, no letters as text, no watermark, no official Epic or Fortnite logo. Make one finished logo emblem, not a sheet of variations. Broad solid shapes with controlled glow rather than thin fiddly lines.
