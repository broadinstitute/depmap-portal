# Data Explorer 2

Data Explorer 2.0 is the replacement for the original Data Explorer (a.k.a.
"Interactive", "Interactive Page"). It features various improvements over the
original.

Note that most of of the DE2 UI code is located in the
[../../portal-frontend/src/data-explorer-2/](https://github.com/broadinstitute/depmap/tree/0fa2d2e/frontend/packages/portal-frontend/src/data-explorer-2)
directory. That code will be migrated here over time. For now, only the
ContextSelector is exported from this package.

## ContextSelector

This is a dropdown component (built with react-select) that allows for
selecting user-defined "contexts." Here we are using "context" as a generic
term for things like cell line lists and gene sets. However, they are not flat
lists. They are rule sets that encode how to derive such a list. Confused?
[This document](https://docs.google.com/document/d/1ADy8QZ5Msw3fmDyW6esacl4WrT_yJ8pFGk53lSbvVqo/edit#heading=h.ln90xjuny1ym)
might help.
