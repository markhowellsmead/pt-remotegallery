# Permanent Tourist Remote Gallery

A lightweight WordPress plugin that registers a Gutenberg block (`Remote Gallery`) to render a remote image gallery fetched from a JSON API.

## Requirements

- WordPress 7.0+
- PHP 8.3+

## What it does

- Registers a block (apiVersion 3) and server-side renders a container with `data-endpoint` and `data-images-per-page` attributes.
- Frontend JavaScript fetches paged image data from the configured endpoint and renders a responsive grid (grid500-style).
- Images are lazy-loaded and will fade in when loaded. Captions are rendered in the DOM but hover-to-show CSS has been disabled by default.
- The block currently does not link images and has no lightbox.

## How to use

1. Install the plugin into `wp-content/plugins/pt-remotegallery` and activate it.
2. Insert the "Remote Gallery" block in the editor.
3. Configure the `endpoint` (default: https://gallery.permanenttourist.ch/api) and `imagesPerPage` in the block inspector.
4. Publish/preview the page — the block will fetch and render images on the frontend.

## Notes for developers

- Server render is in `render.php`; block metadata is in `block.json`.
- Frontend JS/CSS are in `build/frontend.js` and `build/style.css`.
- The CSS variable `--grid-target-height` defaults to `320px` and is increased to `500px` on tall viewports (>1024px).
- Recent customizations removed filters and the lightbox; hover-show caption CSS has been disabled but caption markup remains.

If you want changes (re-enable hover captions, restore lightbox, alter layout heuristics), open an issue or request edits in the codebase.

## Author

Say Hello GmbH, [sayhello.ch](https://sayhello.ch).

## License

GPL v2+