/* Frontend script for PT Remote Gallery
 * - Finds containers with class .pt-remote-gallery
 * - Fetches `/api/meta` for filter options and `/api` for paginated images
 * - Renders filter UI, paged grid and lightbox similar to the original gallery app
 */
(function () {
    "use strict";

    const LOCALE = "en-GB";

    function parseExifDateTime(value) {
        if (typeof value !== "string") return null;
        var match = value.match(
            /^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
        );
        if (!match) return null;
        var iso =
            match[1] +
            "-" +
            match[2] +
            "-" +
            match[3] +
            "T" +
            match[4] +
            ":" +
            match[5] +
            ":" +
            match[6];
        var ts = Date.parse(iso);
        return Number.isNaN(ts) ? null : ts;
    }

    function parseIptcDateTime(dateValue, timeValue) {
        if (typeof dateValue !== "string" || dateValue.length !== 8)
            return null;
        var year = dateValue.substr(0, 4);
        var month = dateValue.substr(4, 2);
        var day = dateValue.substr(6, 2);
        var hh = "00",
            mm = "00",
            ss = "00";
        if (typeof timeValue === "string" && timeValue.length >= 6) {
            hh = timeValue.substr(0, 2);
            mm = timeValue.substr(2, 2);
            ss = timeValue.substr(4, 2);
        }
        var iso =
            year + "-" + month + "-" + day + "T" + hh + ":" + mm + ":" + ss;
        var ts = Date.parse(iso);
        return Number.isNaN(ts) ? null : ts;
    }

    function getCaptureTimestamp(item) {
        var exifCandidates = [
            item && item.datetime_original,
            item && item.datetime_digitized,
            item && item.datetime,
        ];
        for (var i = 0; i < exifCandidates.length; i++) {
            var raw = exifCandidates[i];
            var ts = parseExifDateTime(raw);
            if (ts !== null) return ts;
        }
        return parseIptcDateTime(
            item && item.date_created,
            item && item.time_created,
        );
    }

    function formatTimestamp(ts) {
        if (ts === null || ts === undefined) return "Unknown capture date";
        try {
            return new Date(ts).toLocaleDateString(LOCALE, {
                month: "long",
                year: "numeric",
            });
        } catch (e) {
            return String(ts);
        }
    }

    function getImageLocation(item) {
        var country =
            typeof item && typeof item.country === "string"
                ? item.country.trim()
                : "";
        var includeCountry =
            country !== "" && country.toLowerCase() !== "united kingdom";
        var parts = [
            item && item.sublocation,
            item && item.city,
            item && item.state_province,
            includeCountry ? country : null,
        ].filter(Boolean);
        var seen = new Set();
        var unique = [];
        for (var j = 0; j < parts.length; j++) {
            var part = parts[j];
            var key = String(part).toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(part);
        }
        // Title-case each part (handles hyphens/apostrophes)
        function titleCase(str) {
            // Use locale-aware case operations and a Unicode-aware regex so
            // characters like 'ü' are handled correctly. Only treat explicit
            // separators (start, space, hyphen, apostrophe) as word boundaries
            // — do not depend on \b which is ASCII-only.
            var s = String(str).toLocaleLowerCase(LOCALE);
            return s.replace(/(^|\s|[-'’])(\p{L})/gu, function (_, sep, ch) {
                return sep + ch.toLocaleUpperCase(LOCALE);
            });
        }
        if (unique.length === 0) return "Unknown Location";
        return unique.map(titleCase).join(", ");
    }

    function getImageTags(item) {
        if (!item || !Array.isArray(item.keywords)) return "";
        return item.keywords.join(", ");
    }

    function qs(sel, ctx) {
        return (ctx || document).querySelector(sel);
    }
    function qsa(sel, ctx) {
        return Array.prototype.slice.call(
            (ctx || document).querySelectorAll(sel),
        );
    }

    function createEl(tag, cls, html) {
        var el = document.createElement(tag);
        if (cls) el.className = cls;
        if (html !== undefined) el.innerHTML = html;
        return el;
    }

    // Lightbox: images are non-interactive by default.

    async function fetchJson(url) {
        var res = await fetch(url, { mode: "cors", credentials: "omit" });
        if (!res.ok) throw new Error("Network response not ok: " + res.status);
        return { data: await res.json(), headers: res.headers };
    }

    function buildMetaUrl(endpoint) {
        if (!endpoint) return "/api/meta";
        var e = endpoint.replace(/\/+$/, "");
        if (e.match(/\/api$/)) return e + "/meta";
        return e + "/meta";
    }
    async function fetchImagePage(endpoint, monthYear, country, page, perPage) {
        var url = new URL(endpoint, window.location.origin);
        url.searchParams.set("page", String(page));
        url.searchParams.set("per_page", String(perPage));
        if (monthYear) url.searchParams.set("month_year", String(monthYear));
        if (country) url.searchParams.set("country", String(country));

        var res = await fetch(url.toString(), {
            mode: "cors",
            credentials: "omit",
        });
        if (!res.ok) throw new Error("API returned " + res.status);
        var data = await res.json();

        // Items may be returned as the top-level array, or as an object
        // { data: [...], meta: { total, total_pages }, page }
        var items = Array.isArray(data)
            ? data
            : data && Array.isArray(data.data)
              ? data.data
              : [];

        // Read multiple header variants so we mimic WP REST API behavior.
        var headerPage =
            res.headers.get("X-Page") || res.headers.get("X-WP-Page") || null;
        var headerTotalPages =
            res.headers.get("X-Total-Pages") ||
            res.headers.get("X-WP-TotalPages") ||
            res.headers.get("X-WP-Total-Pages") ||
            null;
        var headerTotal =
            res.headers.get("X-Total") || res.headers.get("X-WP-Total") || null;

        if (typeof headerPage === "string") headerPage = headerPage.trim();
        if (typeof headerTotalPages === "string")
            headerTotalPages = headerTotalPages.trim();
        if (typeof headerTotal === "string") headerTotal = headerTotal.trim();

        var pageCandidate =
            headerPage ||
            (data && (data.page || data.current_page || data.page_number)) ||
            "1";
        var totalPagesCandidate =
            headerTotalPages ||
            (data &&
                (data.total_pages ||
                    data.totalPages ||
                    (data.meta && data.meta.total_pages))) ||
            "0";
        var totalCandidate =
            headerTotal ||
            (data &&
                (data.total ||
                    data.total_count ||
                    (data.meta && data.meta.total))) ||
            String(items.length || 0);

        var pageNum = parseInt(String(pageCandidate), 10) || 1;
        var totalPages = parseInt(String(totalPagesCandidate), 10) || 0;
        var total = parseInt(String(totalCandidate), 10) || 0;

        return {
            data: items,
            page: pageNum,
            totalPages: totalPages,
            total: total,
        };
    }

    function renderImagesToGrid(container, images, append) {
        var grid = qs(".pt-remote-gallery__grid", container);
        if (!append) grid.innerHTML = "";
        function getGridMetrics(item) {
            // Expect item.width and item.height (from API). Fallback to square.
            var w = Number(item.width) || Number(item.w) || null;
            var h = Number(item.height) || Number(item.h) || null;
            var ratio = 1;
            if (w && h) {
                ratio = w / h;
            }
            // padding-bottom percent to preserve aspect ratio: (height/width)*100
            var paddingBottom = 100 / ratio;
            // flexGrow heuristic: clamp ratio between 0.5 and 3 for layout stability
            var flexGrow = Math.min(Math.max(ratio, 0.5), 3);
            return {
                ratio: ratio,
                paddingBottom: paddingBottom,
                flexGrow: flexGrow,
            };
        }

        images.forEach(function (img) {
            var metrics = getGridMetrics(img);

            var item = createEl(
                "div",
                "pt-remote-gallery__image-item c-grid500__item",
            );
            item.style.flexGrow = String(metrics.flexGrow);
            item.style.setProperty("--item-ratio", String(metrics.ratio));
            item.style.flexBasis =
                "calc(var(--grid-target-height, 320px) * " +
                metrics.ratio +
                ")";

            var link = createEl("span", "c-grid500__itemlink");

            var uncollapse = createEl("i", "c-grid500__uncollapse");
            uncollapse.style.paddingBottom = metrics.paddingBottom + "%";

            var fig = createEl("figure", "c-grid500__figure");
            var im = createEl("img", "c-grid500__image");
            im.src = img.thumb || img.url || "";
            im.alt = img.title || "";
            im.loading = "lazy";
            // Add loaded class when image finishes loading (handles lazyload and cached images)
            im.addEventListener("load", function () {
                im.classList.add("is--loaded");
            });
            if (im.complete && im.naturalWidth) {
                im.classList.add("is--loaded");
            }

            fig.appendChild(im);
            link.appendChild(uncollapse);
            link.appendChild(fig);
            item.appendChild(link);

            // Build caption overlays: main meta (title, location, tags, date) and secondary meta (date, location)
            function formatItemDate(it) {
                return formatTimestamp(getCaptureTimestamp(it));
            }

            function getItemLocation(it) {
                return getImageLocation(it);
            }

            function getItemTags(it) {
                return getImageTags(it);
            }

            var meta = createEl("div", "pt-remote-gallery__meta");
            var title = createEl("div", "title", img.title || "Untitled");
            var location = createEl("div", "location", getItemLocation(img));
            var tags = createEl("div", "tags", getItemTags(img));
            var date = createEl("div", "date", formatItemDate(img));
            meta.appendChild(title);
            if (location.textContent) meta.appendChild(location);
            if (tags.textContent) meta.appendChild(tags);
            if (date.textContent) meta.appendChild(date);

            var metaSecondary = createEl(
                "div",
                "pt-remote-gallery__meta-secondary",
            );
            var secondaryDate = createEl("div", "date", formatItemDate(img));
            var secondaryLocation = createEl(
                "div",
                "location",
                getItemLocation(img),
            );
            metaSecondary.appendChild(secondaryDate);
            if (secondaryLocation.textContent)
                metaSecondary.appendChild(secondaryLocation);

            link.appendChild(meta);
            link.appendChild(metaSecondary);

            grid.appendChild(item);

            // images are not linked; no click interaction
        });
    }

    function createPager(container, page, totalPages, targetEl) {
        var pager = targetEl || qs(".pt-remote-gallery__pager", container);
        if (!pager) return;
        pager.innerHTML = "";
        if (totalPages <= 1) return;
        var prev = createEl("button", "pt-remote-gallery__prev", "Prev");
        prev.disabled = page <= 1;
        var next = createEl("button", "pt-remote-gallery__next", "Next");
        next.disabled = page >= totalPages;
        var info = createEl(
            "span",
            "pt-remote-gallery__page",
            " Page " + page + " / " + totalPages + " ",
        );
        pager.appendChild(prev);
        pager.appendChild(info);
        pager.appendChild(next);
        return { prev: prev, next: next };
    }

    async function initContainer(container) {
        var endpoint = container.getAttribute("data-endpoint") || "/api";
        var perPage =
            parseInt(
                container.getAttribute("data-images-per-page") || "20",
                10,
            ) || 20;
        // Allow per-page to be overridden by sessionStorage (keyed by endpoint)
        var storageKey = null;
        try {
            storageKey =
                "pt-remote-gallery-perpage:" +
                encodeURIComponent(endpoint || "default");
            var stored = sessionStorage.getItem(storageKey);
            if (stored !== null) {
                var parsed = parseInt(stored, 10);
                if (!Number.isNaN(parsed) && parsed > 0) perPage = parsed;
            }
        } catch (e) {
            /* sessionStorage not available; ignore */
            storageKey = null;
        }
        var controls = qs(".pt-remote-gallery__controls", container);
        var grid = qs(".pt-remote-gallery__grid", container);
        var pager = qs(".pt-remote-gallery__pager", container);
        var headerPager = qs(".pt-remote-gallery__header-pager", container);

        grid.innerHTML =
            '<div class="pt-remote-gallery__loading">Loading…</div>';

        // filters: hide controls area when present
        if (controls) controls.style.display = "none";

        // Add a transparent header overlay with posts-per-page select.
        // The header itself has pointer-events disabled so it does not block
        // interactions with the gallery, but the select enables pointer
        // events so it remains interactive.
        if (!qs(".pt-remote-gallery__header", container)) {
            container.style.position = container.style.position || "relative";
            var header = createEl("div", "pt-remote-gallery__header");
            // Visual layout moved to CSS (build/style.css)

            var perPageSelect = createEl(
                "select",
                "pt-remote-gallery__perpage",
            );
            [20, 30, 40, 50, 100].forEach(function (n) {
                var opt = createEl("option", null, String(n));
                opt.value = String(n);
                if (Number(n) === Number(perPage)) opt.selected = true;
                perPageSelect.appendChild(opt);
            });
            // Ensure the select reflects the computed perPage value even when
            // sessionStorage is not set (explicit assignment is more reliable
            // than relying on option.selected in some browsers).
            try {
                perPageSelect.value = String(perPage);
            } catch (e) {
                /* ignore */
            }
            // make select interactive despite header's pointer-events:none (CSS)
            perPageSelect.setAttribute("aria-label", "Images per page");
            var selectId =
                "pt-remote-gallery-perpage-" +
                Math.random().toString(36).slice(2, 8);
            perPageSelect.id = selectId;
            perPageSelect.addEventListener("change", function (e) {
                perPage = parseInt(e.target.value, 10) || 20;
                try {
                    if (storageKey)
                        sessionStorage.setItem(storageKey, String(perPage));
                } catch (err) {
                    /* ignore storage errors */
                }
                loadPage(1, false);
            });
            // Visible label for the select (also interactive)
            var perPageLabel = createEl(
                "label",
                "pt-remote-gallery__perpage-label",
                "Per page:",
            );
            perPageLabel.htmlFor = perPageSelect.id;
            // label styles handled in CSS

            // Wrap label+select in a visible semi-opaque background so it's legible
            var controlWrap = createEl(
                "div",
                "pt-remote-gallery__perpage-wrap",
            );
            // controlWrap visual styles moved to CSS
            controlWrap.appendChild(perPageLabel);
            controlWrap.appendChild(perPageSelect);

            header.appendChild(controlWrap);
            // Insert header before the grid so `position: sticky` sticks to the
            // top of the gallery wrapper instead of appearing at the end.
            if (grid && grid.parentNode)
                grid.parentNode.insertBefore(header, grid);
            else container.appendChild(header);
            // Add a pager container into the header (rendered right of controls)
            var headerPager = createEl(
                "div",
                "pt-remote-gallery__header-pager",
            );
            // visual styles moved to CSS; wrapped in same .pt-remote-gallery__perpage-wrap
            var pagerWrap = createEl("div", "pt-remote-gallery__perpage-wrap");
            pagerWrap.appendChild(headerPager);
            header.appendChild(pagerWrap);
        }

        // Pagination: handled via Prev/Next pager

        var currentPage = 1;
        var totalPages = 0;
        var currentFilterMonth = "";
        var currentFilterCountry = "";

        async function loadPage(page, append) {
            grid.innerHTML =
                '<div class="pt-remote-gallery__loading">Loading…</div>';
            try {
                var resp = await fetchImagePage(
                    endpoint,
                    currentFilterMonth,
                    currentFilterCountry,
                    page,
                    perPage,
                );
                // Debug: log pagination headers and response size
                try {
                    var fetchedLog = {
                        endpoint: endpoint,
                        requestedPage: page,
                        perPage: perPage,
                        respPage: resp.page,
                        respTotalPages: resp.totalPages,
                        respTotal: resp.total,
                        respDataLength: Array.isArray(resp.data)
                            ? resp.data.length
                            : 0,
                    };
                    // fetched page logged internally (no debug output)
                } catch (e) {
                    /* noop */
                }
                if (!append) grid.innerHTML = "";
                if (!Array.isArray(resp.data) || resp.data.length === 0) {
                    // show a friendly empty state for first page, otherwise clear grid when appending
                    if (page === 1) {
                        grid.innerHTML =
                            '<div class="pt-remote-gallery__empty">No images found.</div>';
                    }
                } else {
                    renderImagesToGrid(container, resp.data, append);
                }

                currentPage = resp.page || page;
                // Determine effective total pages using x-total-pages when present,
                // otherwise fall back to x-total and perPage.
                var totalCount = resp.total || 0;
                var rawTotalPages = resp.totalPages || 0;
                var effectiveTotalPages =
                    rawTotalPages > 0
                        ? rawTotalPages
                        : totalCount > 0
                          ? Math.ceil(totalCount / perPage)
                          : 0;
                totalPages = effectiveTotalPages || 0;
                var pagerButtons = createPager(
                    container,
                    currentPage,
                    totalPages,
                    headerPager || pager,
                );
                if (pagerButtons) {
                    // remove previous listeners by cloning buttons (simple way to avoid duplicates)
                    var prev = pagerButtons.prev;
                    var next = pagerButtons.next;
                    prev.addEventListener("click", function () {
                        if (currentPage > 1) loadPage(currentPage - 1, false);
                    });
                    next.addEventListener("click", function () {
                        if (currentPage < totalPages)
                            loadPage(currentPage + 1, false);
                    });
                }

                // No load-more button; rely on pager prev/next buttons only.
            } catch (e) {
                // keep any existing grid content and show an unobtrusive error message
                var existing = grid.innerHTML || "";
                grid.innerHTML =
                    existing +
                    '<div class="pt-remote-gallery__error">Unable to load gallery. Try again later.</div>';
                console.error("pt-remotegallery", e);
            }
        }

        // filter controls: page loads without filter options

        // initial load
        loadPage(1, false);
    }

    function initAll() {
        qsa(".pt-remote-gallery").forEach(function (c) {
            initContainer(c);
        });
    }

    window.ptRemoteGalleryInit = initAll;
    document.addEventListener("pt-remote-gallery-ready", initAll);
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", initAll);
    else initAll();
})();
