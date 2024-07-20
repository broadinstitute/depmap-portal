AcceptedTerms = {
  get: function () {
    var accepted_terms = [];
    var accepted_terms_str = Cookies.get("ACCEPTED_TERMS");
    if (accepted_terms_str !== undefined) {
      accepted_terms = accepted_terms_str.split(",");
    }
    return accepted_terms;
  },
  has: function (name) {
    var accepted = AcceptedTerms.get();
    return accepted.indexOf(name) >= 0;
  },
  add: function (name, expiration_num_days) {
    var accepted = AcceptedTerms.get();
    if (accepted.indexOf(name) >= 0) {
      return;
    }
    accepted.push(name);
    if (expiration_num_days === undefined) {
      Cookies.set("ACCEPTED_TERMS", accepted.join(","));
    } else {
      Cookies.set("ACCEPTED_TERMS", accepted.join(","), {
        expires: expiration_num_days,
      });
    }
  },
};
