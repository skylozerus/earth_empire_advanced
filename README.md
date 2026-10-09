# Earth Empire Advanced

A collection of **Tampermonkey userscripts** that enhance the [Earth Empires](https://www.earthempires.com) browser game experience : adding sortable tables, search history, and more to come.

---

## Scripts

All scripts are located in the [`tampermonkey/`](https://github.com/skylozerus/earth_empire_advanced/tree/master/tampermonkey) folder.

| Script | Description |
|--------|-------------|
| [`ee_scores_enhancer.user.js`](https://github.com/skylozerus/earth_empire_advanced/blob/master/tampermonkey/ee_scores_enhancer.user.js) | Adds sortable columns and a live name filter (string or RegExp) to the EE search-results table |
| [`ee_scores_nw_per_acre.user.js`](https://github.com/skylozerus/earth_empire_advanced/blob/master/tampermonkey/ee_scores_nw_per_acre.user.js) | Adds Networth per acre (NW/a) ratio column, quick news history links, and a searchable Special column header to the EE Scores page |
| [`ee_news_search_history.user.js`](https://github.com/skylozerus/earth_empire_advanced/blob/master/tampermonkey/ee_news_search_history.user.js) | Saves the last 5 searched country numbers and adds quick-search buttons above the news form |
| [`ee_advisor_acres_extractor.user.js`](https://github.com/skylozerus/earth_empire_advanced/blob/master/tampermonkey/ee_advisor_acres_extractor.user.js) | Extracts built acres (Land minus Unused Lands) from the Advisor page and stores it in localStorage (OPTIONAL) |
| [`ee_tab_title_scroller.user.js`](https://github.com/skylozerus/earth_empire_advanced/blob/master/tampermonkey/ee_tab_title_scroller.user.js) | Formats tab titles with `[SERVER] EE - [Page]` (from URL path segments) and continuously scrolls title text |

### Suggestion 
Install atleast the first 2 scripts, via the source file via clicking the link, and then chose raw for tampermonkey to find it automaticly.
---

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click on any script link in the table above
3. Click the **Raw** button on GitHub
4. Tampermonkey will detect the userscript and prompt you to install it --> click **Install**

---

## Development

```bash
# Install dependencies
npm install

# Lint scripts
npm run lint
```
