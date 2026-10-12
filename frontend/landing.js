(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Audience toggle */
  var btns = document.querySelectorAll("#audience-toggle button");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      btns.forEach(function (x) { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
      b.classList.add("active"); b.setAttribute("aria-selected", "true");
      document.querySelectorAll(".audience-panel").forEach(function (p) { p.classList.remove("active"); });
      document.getElementById("panel-" + b.dataset.panel).classList.add("active");
    });
  });

  /* Bento cells enter as they scroll into view */
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    items.forEach(function (el, i) { el.style.setProperty("--d", (i % 3) * 90 + "ms"); io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add("in"); }); }

  /* Pointer tilt on bento cells (mouse only) */
  if (!reduce) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", ((px - 0.5) * 6).toFixed(2) + "deg");
        el.style.setProperty("--rx", ((0.5 - py) * 6).toFixed(2) + "deg");
        el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      });
      el.addEventListener("pointerleave", function () {
        el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      });
    });
  }
})();
