setTimeout(function () {
    app.models.Github.updateFrontend();
    app.models.Github.runDailyUpdate();
}, 1000);
