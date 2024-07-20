function loadAsyncTab(elementId, url) {
  /**
   * Loads the contents of `url` into the element with id `elementId`.
   *
   * Assumes that the contents exist.
   */

  const el = document.getElementById(elementId);
  const _loadAsyncTab = () => {
    fetch(url)
      .then((response) => {
        return response.text();
      })
      .then((text) => {
        el.innerHTML = text;
      })
      .catch((err) => {
        el.innerHTML = "Something went wrong";
        console.log(err);
      });
  };

  // If the tab is the current active tab, load the contents
  if (el.classList.contains("active")) {
    _loadAsyncTab();
    return;
  }

  // Otherwise, listen for when the tab is set to active, then load the contents
  const callback = (mutationsList, observer) => {
    mutationsList.forEach((mutation) => {
      if (
        mutation.attributeName === "class" &&
        el.classList.contains("active")
      ) {
        _loadAsyncTab();
        // Stop listening for class name changes
        observer.disconnect();
      }
    });
  };

  const mutationObserver = new MutationObserver(callback);

  mutationObserver.observe(el, { attributes: true });
}
