# Resource Pages — How Forum Content Is Pulled

This report describes how the DepMap portal's **Resources** pages pull content
from the [Discourse](https://www.discourse.org/) forum, which pages display that
content, and the URL/parameter conventions used (slugs vs. IDs, topic vs. post).

There are **two code paths** in the tree:

1. **The production path** (`/resources`) — the current, live implementation
   built around `DiscourseClient` with a SQLite cache.
2. **A legacy prototype path** (`/documentation_prototype/`) — an older
   proof-of-concept that hits the forum directly. It is not linked from the UI
   and is kept only for reference.

Both are documented below, but the production path is the one that matters.

---

## 1. High-level data flow (production)

```
Discourse forum (https://forum.depmap.org/)
        │   HTTP GET *.json  (Api-Key + Api-Username: system headers)
        ▼
DiscourseClient  ──►  SQLite cache (RESOURCES_DATA_PATH, via SqliteDict)
        │
        ├─ reload=True  → fetch from forum, write to cache   (/resources/reload)
        └─ reload=False → read from cache only               (/resources)
        ▼
get_root_category_subcategory_topics()  → RootCategory / Subcategory / Topic
        │   HTML sanitized + URLs rewritten (bs4 + html_sanitizer)
        ▼
templates/public/resources.html   (embeds JSON in a <script> tag)
        ▼
resourcesPage.tsx → ResourcesPage.tsx / SubcategoryPanel.tsx  (React)
```

Key point: **the live page never calls Discourse at request time.** `/resources`
reads pre-fetched, sanitized content out of a local SQLite cache. The cache is
(re)populated only when `/resources/reload` is hit, which runs the client in
`reload=True` mode.

---

## 2. The Discourse API client

**File:** `depmap/discourse/client.py` — class `DiscourseClient`

- **Auth:** every request sends headers `Api-Key: <key>` and
  `Api-Username: system` (`client.py:25`).
- **Session/retries:** `requests.Session` with retry on `429`, `500`
  (`total=5, backoff_factor=3`) (`client.py:26`).
- **Two modes** (`reload` flag):
  - `reload=True` — GET from the forum, store the JSON result in the SQLite
    cache keyed by the request URL, then return it.
  - `reload=False` — read the previously stored value straight from the cache
    (no network call).

### Discourse endpoints called

| Method                                            | Discourse endpoint                          | Identifier used                | Purpose                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_category_with_subcategories(category_slug)`  | `GET /categories.json`                      | filtered by **slug** in Python | Get the root "resources" category + its `subcategory_ids`. (`/c/{id}/show.json` doesn't return subcategories, so the full list is fetched and filtered by slug.) `client.py:62-80` |
| `get_category(category_id)`                       | `GET /c/{category_id}/show.json`            | **numeric ID**                 | Get one subcategory's info (name, slug, `read_restricted`). `client.py:47-60`                                                                                                      |
| `get_category_topics(category_slug, category_id)` | `GET /c/{category_slug}/{category_id}.json` | **slug AND ID** (both in path) | List topics in a subcategory. `client.py:82-106`                                                                                                                                   |
| `get_topic_main_post(topic_id)`                   | `GET t/{topic_id}/posts.json`               | **topic ID**                   | Get the topic's post stream; only `posts[0]` (the first/main post) is used. `client.py:108-122`                                                                                    |

**Topic filtering & ordering** (`client.py:92-100`): topics where
`visible == False` (unlisted) or `archived == True` are dropped. Remaining topics
are sorted so `pinned` topics come first.

---

## 3. Assembling the page model

**File:** `depmap/public/resources.py`

`get_root_category_subcategory_topics(client, sanitizer, category_slug, default_topic_id)`
(`resources.py:126-184`) builds the nested object tree rendered by the frontend:

- `RootCategory{ title, subcategories[], default_topic }`
- `Subcategory{ id, slug, title, topics[] }`
- `Topic{ id, slug, title, post_content, creation_date, update_date }`

Logic:

1. Get the root category by **slug**; read its `subcategory_ids` (order is
   whatever is configured in Discourse).
2. For each subcategory ID: fetch its info, **skip it if `read_restricted`**
   (not public), then fetch its topics.
3. For each topic: fetch the **main post** (`posts[0]`) and use its `cooked`
   (rendered HTML) field as `post_content`.
4. If a topic's `topic_id` equals the configured `default_topic_id`, it's stored
   as `root_category.default_topic` (what shows on first load).

### HTML processing (`resources.py:37-123`)

The forum's `cooked` HTML is cleaned before being embedded:

- **Sanitized** via `html_sanitizer.Sanitizer` with an extended tag allow-list
  (div, img, table/thead/tr/th/td/tbody, code, blockquote).
- **Relative URLs rewritten** (`modify_forum_relative_urls`): Discourse returns
  non-image attachment links as relative paths (e.g.
  `/uploads/short-url/xyz.pdf`); these are prefixed with the forum base URL. All
  links also get `target="_blank"`, and in-page anchor links starting with `#p`
  (jump-to-post anchors) are removed.
- **Image meta links removed** (`remove_img_link`): strips Discourse's
  `div.lightbox-wrapper > div.meta` link block.
- **"View Post in Forum" link appended** (`add_forum_link_to_html`,
  `resources.py:77-96`): a link is built as
  **`{forum_url}/t/{topic_slug}/{topic_id}`** — i.e. the canonical Discourse
  topic URL form containing **both the topic slug and the topic ID**.

`creation_date` / `update_date` come from the main post's `created_at` /
`updated_at`, reformatted to `"%d %b %Y %I:%M%p"`.

---

## 4. Backend routes (Flask)

**File:** `depmap/public/views.py`

| Route                           | Handler                                        | What it does                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /resources`                | `resources()` `views.py:178-210`               | Builds `DiscourseClient` in **read mode** (`reload=False`), reads cached content, renders `public/resources.html`. `abort(404)` if config missing or category not found; `abort(429)` on forum rate-limit. |
| `GET /resources/reload`         | `resources_reloads()` `views.py:154-175`       | Builds client in **reload mode** (`reload=True`), calls `refresh_all_category_topics()` to re-fetch everything from the forum into the SQLite cache. Renders `public/resources_reload.html`.               |
| `GET /documentation/`           | `documentation()` `views.py:138-151`           | **Redirects** to `public.resources` (the old documentation page now points at Resources).                                                                                                                  |
| `GET /documentation_prototype/` | `documentation_prototype()` `views.py:114-135` | **Legacy prototype** (see §7). Marked "should not be accessible anywhere in the portal UI."                                                                                                                |

`refresh_all_category_topics()` (`resources.py:187-207`) walks the same
category → subcategories → topics → main-post traversal, but purely to warm the
cache (it discards the results). It asserts the client is in reload mode.

---

## 5. Configuration

**Defaults (public):** `config/public/settings.py`

| Setting                            | Value                                    | Meaning                       |
| ---------------------------------- | ---------------------------------------- | ----------------------------- |
| `FORUM_URL`                        | `https://forum.depmap.org/`              | Discourse base URL            |
| `FORUM_RESOURCES_CATEGORY`         | `"resources"`                            | Root category **slug**        |
| `FORUM_RESOURCES_DEFAULT_TOPIC_ID` | `3396`                                   | **Topic ID** shown by default |
| `RESOURCES_DATA_PATH`              | `<WEBAPP_DATA_DIR>/resources/results.db` | SQLite cache path             |
| `FORUM_API_KEY`                    | from env / file                          | Discourse API key             |

**Dev:** `config/dev/settings.py:139-170` — `FORUM_API_KEY` is a **file path** in
dev (read by `read_forum_api_key`, `resources.py:210-218`), and the forum
settings are pulled per-environment via `get_setting_from_config(...)`.
`read_forum_api_key` treats the config value as a file to read if it's a valid
path, otherwise as the literal key — so the same code works in dev (file) and
prod (env var / literal).

Note the default topic is identified by **numeric topic ID** (`3396`), whereas
the category is identified by **slug** (`"resources"`).

---

## 6. Frontend rendering & page URLs

**Entry template:** `depmap/templates/public/resources.html`

- Serializes the `RootCategory` to JSON inside
  `<script id="react-resources-page-data" type="application/json">` and loads
  `resourcesPage.js` into `<div id="react-resources-page">`.

**Entry component:** `frontend/packages/portal-frontend/src/apps/resourcesPage.tsx`

- Parses that JSON, wraps in a `BrowserRouter`, and renders `<ResourcesPage>`
  with `title`, `subcategories`, `defaultTopic` (`rootCategory.default_topic`).

**Page component:** `src/resources/components/ResourcesPage.tsx`

- Left: a `PanelGroup` of `SubcategoryPanel`s (one per subcategory).
- Right: the selected topic's `post_content` rendered via
  `dangerouslySetInnerHTML`, plus its `creation_date` / `update_date`.
- Selection is driven entirely by **URL query parameters**, read with
  `URLSearchParams`:
  - `?subcategory=<subcategory slug>` selects which panel is expanded.
  - `?topic=<topic slug>` selects which topic is shown.
  - With no params, `defaultTopic` (the configured default topic ID) is shown.

**Panel component:** `src/resources/components/SubcategoryPanel.tsx`

- Each topic link is a react-router `<Link>` to
  **`?subcategory=${subcategory.slug}&topic=${topic.slug}`** (`SubcategoryPanel.tsx:56`).

**Models:** `src/resources/models/Category.ts` — `Subcategory{ id, slug, title, topics }`, `Topic{ id, slug, title, post_content, creation_date, update_date }`.

### URL / identifier summary

There are **two distinct URL spaces**:

1. **Portal resources page URL** (what the user navigates within the site):

   ```
   /resources?subcategory=<subcategory-slug>&topic=<topic-slug>
   ```

   - Uses **slugs**, not IDs, for both subcategory and topic.
   - Navigation is client-side (react-router); the query params select content
     already embedded in the page. There is no per-topic server round-trip.

2. **Deep link back into Discourse** ("View Post in Forum", appended to each
   topic's HTML):

   ```
   {FORUM_URL}/t/<topic-slug>/<topic-id>
   ```

   - Canonical Discourse topic form: **topic slug + topic ID** (this is a
     _topic_ ID, not a post ID).

Underlying the whole thing, the **Discourse API** calls mix identifiers:
`/categories.json` (filtered by slug), `/c/{id}/show.json` (ID),
`/c/{slug}/{id}.json` (both), `t/{topic_id}/posts.json` (topic ID). The unit of
content displayed is always the **first/main post** (`posts[0]`) of each topic —
replies are not shown on the production Resources page.

---

## 7. Legacy prototype (reference only)

**File:** `depmap/public/fetch_forum_resources.py`, route
`GET /documentation_prototype/` (`views.py:114-135`).

This older path calls Discourse **directly at request time** (no cache):

- `fetch_staff_topics()` → `GET https://{forum_url}/c/staff/3.json` — hardcoded
  to the **`staff` category, ID `3`** (a placeholder; see the in-code TODOs).
- `fetch_posts(topic_id)` → `GET https://{forum_url}/t/{topic_id}/posts.json` —
  by **topic ID**.
- Unlike production, it renders **all** posts in a topic (not just the main
  post) and does minimal URL rewriting.

It is explicitly a prototype ("should not be accessible anywhere in the portal
UI") and is superseded by the `DiscourseClient` production path. New work should
ignore it.

---

## 8. Key files

| Concern                               | File                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| Discourse API client + cache          | `depmap/discourse/client.py`                                                      |
| Page model assembly + HTML processing | `depmap/public/resources.py`                                                      |
| Date helper                           | `depmap/discourse/utils.py` (`reformat_date`)                                     |
| Flask routes                          | `depmap/public/views.py` (`resources`, `resources_reloads`)                       |
| Server template                       | `depmap/templates/public/resources.html`                                          |
| React entry                           | `frontend/packages/portal-frontend/src/apps/resourcesPage.tsx`                    |
| React page                            | `frontend/packages/portal-frontend/src/resources/components/ResourcesPage.tsx`    |
| React subcategory panel               | `frontend/packages/portal-frontend/src/resources/components/SubcategoryPanel.tsx` |
| TS models                             | `frontend/packages/portal-frontend/src/resources/models/Category.ts`              |
| Config (public)                       | `config/public/settings.py`                                                       |
| Config (dev)                          | `config/dev/settings.py`                                                          |
| Legacy prototype                      | `depmap/public/fetch_forum_resources.py`                                          |
