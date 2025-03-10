These functions are for reading/writing "packed correlation tables". Because correlation tables are large,
and the number of correlation tables we need to store grows quickly (n^2) I've made up this custom format
to squeeze most of the space out while being fairly efficient at looking up all correlations for a
single feature.

This code is used by the preprocessing pipeline (to write the tables) and breadbox (to read the tables)

To accomodate that, I've made this function into a tiny package so it can be
a shared depenedency.

To run tests:

```
pytest
```

To publish package:

```
poetry publish --build --repository public-python
```
