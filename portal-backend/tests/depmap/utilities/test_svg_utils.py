def assert_is_svg(svg):
    assert "<svg" in svg and svg.strip().endswith("</svg>")
