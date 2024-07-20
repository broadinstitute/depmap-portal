def merge_results(results):
    """given results (list of (cell_line, unpacked_obj) tuples), merge into a single 'mat' json object in the format
    the bubble plot is expecting."""
    x_set = set()
    y_set = set()
    data = []

    for result in results:
        if result is None:
            continue

        cell_line = result["cell_line"]

        y_set.add(cell_line)

        chromosome = result["chromosome"]
        columns = result["columns"]
        for position in columns["position"]:
            x_set.add("{}:{}".format(chromosome, position))

        for position, methylation, coverage, color, size in zip(
            columns["position"],
            columns["methylation"],
            columns["coverage"],
            columns["color"],
            columns["size"],
        ):
            data.append(
                dict(
                    y=cell_line,
                    x="{}:{}".format(chromosome, position),
                    value=color,
                    coverage=coverage,
                    meth=methylation,
                    r=size,
                )
            )

    x = sorted(x_set)
    y = sorted(y_set)

    return dict(x=x, y=y, data=data)
