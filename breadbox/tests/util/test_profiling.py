from breadbox.utils import profiling


def test_profiling(monkeypatch):
    output = []

    def capture_log(msg):
        output.append(msg)

    monkeypatch.setattr(profiling, "PRINT_PROFILE", True)
    monkeypatch.setattr(profiling, "print_log", capture_log)

    with profiling.profiled_region("a"):
        print("in a")
        with profiling.profiled_region("b"):
            print("in b")
            with profiling.profiled_region("c"):
                print("in c")
        with profiling.profiled_region("d"):
            print("in d")

    all_output = "\n".join(output)
    print("output from print_log:")
    print(all_output)
    # just sanity check to make sure something was printed
    assert "a: start_max_rss:" in all_output
    assert "   b: start_max_rss:" in all_output
    assert "elapsed" in all_output
