function showMailingPopUp(lid) {
  window.dojoRequire(["mojo/signup-forms/Loader"], function (L) {
    L.start({
      baseUrl: "mc.us17.list-manage.com",
      uuid: "4b8fa0c224256244200abe5c5",
      lid: lid,
      uniqueMethods: true,
    });
  });
  document.cookie =
    "MCEvilPopupClosed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  document.cookie =
    "MCPopupSubscribed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  document.cookie =
    "MCPopupClosed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
}
