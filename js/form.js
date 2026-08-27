/* ==========================================================================
   FORM — validation + submission (endpoint-ready, no page reload)
   ========================================================================== */
(function () {
  "use strict";

  var form = document.getElementById("inquiryForm");
  if (!form) return;

  var statusEl = document.getElementById("formStatus");
  var successEl = document.getElementById("formSuccess");
  var submitBtn = document.getElementById("submitBtn");
  var ENDPOINT = (window.SITE && SITE.formEndpoint) || "";

  /* date input: nothing in the past */
  var dateInput = document.getElementById("fDate");
  if (dateInput) {
    var today = new Date();
    var iso = today.getFullYear() + "-" +
      String(today.getMonth() + 1).padStart(2, "0") + "-" +
      String(today.getDate()).padStart(2, "0");
    dateInput.min = iso;
  }

  function fieldOf(input) {
    return input.closest(".field");
  }

  function showError(input, show, message) {
    var field = fieldOf(input);
    if (!field) return;
    var err = field.querySelector(".field__error");
    if (!err) return;
    field.classList.toggle("has-error", show);
    err.hidden = !show;
    if (message) err.textContent = message;
    input.setAttribute("aria-invalid", show ? "true" : "false");
  }

  function validateField(input) {
    var v = (input.value || "").trim();
    var bad = false;
    var msg = "";

    if (input.hasAttribute("required") && !v) {
      bad = true;
      msg = input.dataset.requiredMsg || "This field is required.";
    } else if (input.type === "email" && v &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      bad = true; msg = "Please enter a valid email address.";
    } else if (input.type === "tel" && v &&
      !/^[+()\-.\s\d]{6,20}$/.test(v)) {
      bad = true; msg = "Please enter a valid phone number.";
    } else if (input.type === "date" && v && input.min && v < input.min) {
      bad = true; msg = "Please choose a date in the future.";
    }

    showError(input, bad, bad ? null : "");
    return !bad;
  }

  function validateAll() {
    var inputs = form.querySelectorAll("input[required], select[required], textarea[required]");
    var firstBad = null;
    inputs.forEach(function (i) {
      var ok = validateField(i);
      if (!ok && !firstBad) firstBad = i;
    });
    if (firstBad) {
      firstBad.focus({ preventScroll: false });
      firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return !firstBad;
  }

  /* live re-validation once a field was marked invalid */
  form.addEventListener("input", function (e) {
    var f = fieldOf(e.target);
    if (f && f.classList.contains("has-error")) validateField(e.target);
  });
  form.addEventListener("change", function (e) {
    if (e.target.matches("select")) validateField(e.target);
  });

  /* ---------------- Submission ---------------- */
  function collect() {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      data[key] = typeof value === "string" ? value.trim() : value;
    });
    return data;
  }

  function finish(success) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Inquiry";
    if (!success) return;

    form.hidden = true;
    successEl.hidden = false;
    successEl.focus({ preventScroll: true });
    successEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    /* honeypot — bots only */
    var hp = document.getElementById("fCompany");
    if (hp && hp.value) return;

    statusEl.textContent = "";
    statusEl.classList.remove("is-error");

    if (!validateAll()) {
      statusEl.textContent = "Please review the highlighted fields.";
      statusEl.classList.add("is-error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    var payload = collect();

    if (ENDPOINT) {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed: " + res.status);
          return res.json().catch(function () { return {}; });
        })
        .then(function () { finish(true); })
        .catch(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Inquiry";
          statusEl.textContent =
            "Something went wrong sending your inquiry — please email hello@isabellamarchetti.com directly.";
          statusEl.classList.add("is-error");
        });
    } else {
      /* No endpoint configured yet — simulate a successful send so the
         experience can be tested locally. Wire SITE.formEndpoint in
         js/content.js to go live. */
      setTimeout(function () { finish(true); }, 900);
    }
  });
})();
