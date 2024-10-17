// js/scale.fix.js
(function(document) {
    const metas = document.getElementsByTagName('meta');

    // Change the content of the viewport meta tag
    function changeViewportContent(content) {
        for (let i = 0; i < metas.length; i++) {
            if (metas[i].name === "viewport") {
                metas[i].content = content;
            }
        }
    }

    // Initialize default viewport settings
    function initialize() {
        changeViewportContent("width=device-width, minimum-scale=1.0, maximum-scale=1.0");
    }

    // Adjust viewport during touch gestures (start)
    function gestureStart() {
        changeViewportContent("width=device-width, minimum-scale=0.25, maximum-scale=1.6");
    }

    // Reset viewport after touch gestures (end)
    function gestureEnd() {
        initialize();
    }

    // Apply settings for iPhone devices
    if (navigator.userAgent.match(/iPhone/i)) {
        initialize();
        document.addEventListener("touchstart", gestureStart, false);
        document.addEventListener("touchend", gestureEnd, false);
    }
})(document);
