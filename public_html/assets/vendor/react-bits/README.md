# React Bits Letter Glitch

Copyright (c) 2026 David Haz. See LICENSE.md.

## Dock taskbar

Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/Dock/Dock.jsx

`js/dock.js` adapts upstream cosine distance magnification and substepped implicit spring to the static page (base 34, peak 72, distance 180, gap 12, panel height 38, roundness 0.45, no tiles/badges). `Dock.source.jsx` preserves the reference source and is not loaded at runtime. Links use native anchors; music keeps its original controller ID; Settings contains the existing color and language controls. Popup coordination, inert collapsed panels, keyboard arrows/Escape, safe-area placement, width-constrained magnification and reduced motion support are native. Event listeners and frames clean up on pagehide and restore on pageshow. No React runtime is added.

Hover responsiveness: pointer coordinates map from the current expanded button bounds to the rest slots, keeping the actual hovered button dominant. A critically damped spring (normalized stiffness 6400, damping 160) follows rapid changes. Dock links override the site's global `transition: all` so CSS does not lag behind the JS geometry; color and tooltips use 60ms transitions only.

## Elastic Slider music player

Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/ElasticSlider/ElasticSlider.jsx

`js/music-elastic.js` adapts the horizontal rubber resistance and substepped spring equations to native range inputs: maxStretch 47, bounce 0.35, thickness 6/12, grow on hover/focus, click to seek, no thumb and no scroll-wheel capture. `ElasticSlider.source.jsx` preserves upstream source for reference; it is not loaded by the page. Native keyboard semantics and the original audio/playlist engine remain. Fill and interactive colors use the site's live theme variables instead of the demo's fixed white. Reduced motion disables stretch and spring; frames run only until settled, with lifecycle cleanup and BFCache restoration.

Music artwork now comes from `assets/cover-png/`. Its read-only `index.php` automatically lists image files on the PHP host; `js/music-covers.js` assigns a shuffled bag without reuse between distinct tracks until exhausted. Track assignments stay stable within a page session/catalog. Python's local directory listing is also supported. No per-frame work or polling timer is added. Folder changes are checked when changing tracks (30-second throttle); file modification times version image URLs. See `assets/cover-png/README.md` for image sizes and usage. The old demo asset is no longer used.

## Shiny Text identity preset

Source: https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/ShinyText

`js/identity-shine.js` adapts the soft gamma-correct gradient, smooth sweep and damped pointer following to the static site's lifecycle. The display name alone uses the requested gray/white 19% band at 131 degrees, 1.3-second sweeps and 0.8-second rests with yoyo. Pointer following takes priority while hover pauses the autonomous sweep. Touch keeps the loop; reduced motion and forced colors render stable text. Timers replace frames during rests; hidden/offscreen instances stop. Other typography effects are unchanged.

`js/identity-shatter.js` is an original canvas implementation inspired by the public Shatter Type interaction description at https://pro.reactbits.dev/docs/components/shatter-type; it contains no React Bits Pro source. A bounded triangle mesh assembles on first view, cracks locally under the pointer, bursts on click/tap/Enter/Space, then recovers. An idle burst runs after four seconds away from the pointer. Its glyph atlas shares the gray/white shine position, never a separate colored text palette. The DOM identity, font and layout remain intact. Frames and timers stop offscreen, hidden, or under reduced motion; lifecycle cleanup removes the canvas and listeners.

Source: https://github.com/DavidHDev/react-bits/blob/e2eb04d89d5be5a633dba7b2d4adfd274e053767/src/content/Backgrounds/LetterGlitch/LetterGlitch.jsx

Meow Bio uses the original WebGL2 renderer and interactions in js/letter-glitch.js, adapted from React hooks to a single page lifecycle. No runtime dependencies.

The fixed background listens passively during pointer capture. It never owns pointer events, tab focus or text selection. Hidden tabs stop rendering, reduced motion produces a still, and unavailable WebGL2 leaves the near-black base. ResizeObserver rebuilds the glyph atlas/grid for viewport and DPR changes. The main page does not load the legacy Three.js background.

## Meow Bio cursor elevation

The fragment shader inverse-projects a Gaussian raised surface into the existing glyph atlas: at most 18% magnification, 12 CSS px vertical displacement, and 5 CSS px velocity parallax. Directional slope shading and color activation affect glyph coverage only. The cursor follows with exponential smoothing (70 ms); lift rises over 180 ms and recovers over 380 ms, with no spring overshoot. Existing horizontal streaks and tear walkers are unchanged. Reduced motion disables displacement and reactive animation.

## Section Particles

Source: https://github.com/DavidHDev/react-bits/blob/482ab1cd3f567467a8dc9f49683bcefe54223e2c/src/content/Backgrounds/Particles/Particles.jsx

js/section-particles.js retains upstream WebGL2 instanced shaders, seeded cloud distribution, rotation, bobbing and smooth hover parallax. React hooks are adapted to the page lifecycle; unused connections and click bursts are omitted. A fragment-shader union of the rounded card interiors in About, Services, Skills, Focus, Experience and Connect reveals one shared particle field. The same context draws opaque near-black card surfaces before the particles; card CSS surfaces become transparent only after successful renderer initialization. This separates particles inside cards from Letter Glitch outside them. Body clipping, card radius, hover translation and reveal opacity follow the DOM. No per-card canvas or particle instance is created. The profile sidebar and footer are included as rounded standalone cards at the user's request. Security Lab remains outside the selected card mask. Letter Glitch remains an independent global renderer.

640 particles on desktop, 320 on mobile, 240 with Save Data or <=4 CPU threads. Capped at 30/24 fps and DPR 1.5/1.25. Rendering stops offscope or hidden. Reduced motion renders a still and updates only on layout/scroll changes. Observers, listeners, frames and GPU resources are cleaned up on pagehide and restored on pageshow/context restoration.
# Music controller motion

`js/music-motion.js` adapts the normalized pointer coordinates, spring settling and perspective rotation of [Tilted Card](https://github.com/DavidHDev/react-bits/tree/main/src/content/Components/TiltedCard), by David Haz, under the license in this folder. `css/music-motion.css` supplies the controller entrance and smaller touch entrance. No React runtime is added.

The controller uses a restrained 3.2/4.2 degree tilt. Rotation freezes during a held pointer so slider gestures remain stable. Touch devices do not tilt, reduced motion disables entrance and tilt, and frames stop when settled, closed or hidden. All listeners and the class observer are disposed on pagehide and restored on pageshow.

A separate CSS `translate` animation floats the open panel up to 6px over a 5.4s cycle (3px on touch/mobile), starting after the entrance. It pauses at its current phase on mouse hover, held presses, visible keyboard focus and open playlist menus, then resumes without snapping. Tilt also freezes while a playlist menu is open. Float stops on close and is disabled with reduced motion. No extra JavaScript loop is added.
