def is_mobile(request):
    mobile_override = request.args.get("mobile")

    if mobile_override == "true":
        return True
    elif mobile_override == "false":
        return False

    is_mobile = request.user_agent.platform in {"android", "blackberry", "iphone"}

    return is_mobile
