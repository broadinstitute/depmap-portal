// How many categories a plot gives their own color or facet panel by default,
// and what the picker encourages. Soft: someone can raise it, up to the hard cap
// below. 16 is about as far as small multiples stay legible, and it matches
// MAX_EXPANSION_MEMBERS, the ceiling on the expansion cap — a plot showing 16
// groups should feel the same however the grouping was arrived at. The expansion
// cap scales below its ceiling with the index being expanded; this one doesn't
// need to, because categories partition the points rather than multiplying them.
export const SOFT_MAX_CATEGORIES = 16;

// The most a plot will draw, however deliberately it was asked. Past the soft
// cap things degrade rather than break, but they degrade differently: a 40th
// facet is small yet still itself, whereas past the palette's 18 colors two
// categories must share a swatch. Both are permitted and neither is silent.
//
// 40 is where the plot itself gives out rather than where it stops reading
// well — faceting gene-level points by an annotation falls over somewhere
// around there, and legibility had already gone well before it. Set from the
// heaviest case rather than the typical one: it is a single global number, and
// lighter data could certainly carry more, but a limit that holds everywhere is
// worth more than one tuned per dataset that nobody can predict.
export const HARD_MAX_CATEGORIES = 40;

// Above this many distinct values per plotted entity, an annotation has stopped
// being a category and become an identifier — the average group holds fewer than
// two points, so no selection of 16 can represent it and no ranking is
// meaningful. A ratio rather than a count on purpose: 300 distinct lineages
// across 2000 models is an annotation, 300 across 320 is a primary key.
export const IDENTIFIER_LIKE_RATIO = 0.5;

export const MAX_POINTS_TO_ANNOTATE = 50;
