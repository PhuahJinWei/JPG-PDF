/*
	Created by Phuah Jin Wei
	Version 2.24 (allow multi-conversion)
	Created Date: 2025/10/15
	Last Updated: 2025/10/17
*/

if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist/build/pdf.worker.js";
}

// ===== Uploader logic =====
(function () {
  const dz = document.getElementById("drop-zone");
  const input = document.getElementById("file-uploader");
  const list = document.getElementById("file-list");
  const err = document.getElementById("error-message");
  const hint = document.getElementById("drop-hint");
  const convertBtn = document.getElementById("convert-btn");

  if (!dz || !input) return;

  // ===== State =====
  // Authoritative list, ordered by add-time
  let currentFiles = [];
  // Expose for converter script
  window.__currentFiles = currentFiles;
  // Avoid loops on programmatic updates
  let suppressInputChange = false;

  // ===== Helpers =====
  function getMode() {
    const r = document.querySelector('input[name="conversion"]:checked');
    return r ? r.value : "pdf-to-jpg";
  }

  function setAcceptByMode() {
    const mode = getMode();
    if (mode === "pdf-to-jpg") {
      input.setAttribute("accept", ".pdf,application/pdf");
      if (hint) hint.textContent = "Click to browse or drop PDF files";
    } else {
      input.setAttribute(
        "accept",
        ".jpg,.jpeg,.png,image/jpeg,image/png"
      );
      if (hint) hint.textContent = "Click to browse or drop JPG/PNG images";
    }
  }

  const fmt = (b) => {
    if (b === 0) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    const v = b / Math.pow(1024, i);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + " " + u[i];
  };

  const clearError = () => {
    if (err) err.textContent = "";
  };

  const setError = (m) => {
    if (err) err.textContent = m;
  };

  function updateConvertButton() {
    convertBtn.disabled = currentFiles.length === 0;
  }

  function renderFileList() {
    list.innerHTML = "";
    currentFiles.forEach((f, idx) => {
      const chip = document.createElement("span");
      chip.className = "chip";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = f.name;

      const size = document.createElement("span");
      size.className = "size";
      size.textContent = "· " + fmt(f.size);

      const remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${f.name}`);
      remove.textContent = "×";

      remove.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentFiles.splice(idx, 1);
        window.__currentFiles = currentFiles;
        syncHiddenInput(false);
        renderFileList();
        updateConvertButton();
      });

      remove.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      });

      chip.appendChild(name);
      chip.appendChild(size);
      chip.appendChild(remove);
      list.appendChild(chip);
    });
  }

  function syncHiddenInput(fireChange) {
    const dt = new DataTransfer();
    currentFiles.forEach((f) => dt.items.add(f));
    suppressInputChange = !fireChange;
    input.files = dt.files;
    if (fireChange) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setTimeout(() => {
      suppressInputChange = false;
    }, 0);
  }

  function allowByMode(file) {
    const mode = getMode();
    const name = (file.name || "").toLowerCase();
    const type = file.type;

    if (mode === "pdf-to-jpg") {
      return type === "application/pdf" || name.endsWith(".pdf");
    }

    return (
      type === "image/jpeg" ||
      type === "image/png" ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png")
    );
  }

  function applyNewFiles(fileList, { append = false } = {}) {
    clearError();
    const incoming = Array.from(fileList);
    const valid = incoming.filter(allowByMode);
    const skipped = incoming.length - valid.length;

    if (!valid.length && !append) {
      setError(
        getMode() === "pdf-to-jpg"
          ? "Please select a PDF file."
          : "Please select JPG/PNG images."
      );
      return;
    }

    currentFiles = append ? currentFiles.concat(valid) : valid;
    window.__currentFiles = currentFiles;
    syncHiddenInput(false);
    renderFileList();
    updateConvertButton();

    if (skipped > 0) {
      setError(
        `${skipped} file(s) were skipped because they don't match the selected mode.`
      );
    }
  }

  // ===== Wire up UI =====
  setAcceptByMode();

  document.querySelectorAll('input[name="conversion"]').forEach((el) => {
    el.addEventListener("change", () => {
      setAcceptByMode();
      // Reset selection when mode changes
      currentFiles = [];
      window.__currentFiles = currentFiles;
      clearError();
      renderFileList();
      syncHiddenInput(false);
      updateConvertButton();
    });
  });

  // Click + keyboard to open chooser
  const openChooser = () => {
    clearError();
    input.click();
  };

  dz.addEventListener("click", (e) => {
    if (e.target.closest(".remove")) return;
    openChooser();
  });

  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target.closest(".remove")) return;
      e.preventDefault();
      openChooser();
    }
  });

  // Chooser change (ignore programmatic sync)
  input.addEventListener("change", () => {
    if (suppressInputChange) return;
    if (!input.files || input.files.length === 0) {
      // cancel -> keep existing
      return;
    }
    applyNewFiles(input.files, { append: false });
  });

  // Drag & drop
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover"].forEach((evt) => {
    dz.addEventListener(
      evt,
      (e) => {
        stop(e);
        dz.classList.add("is-dragover");
      },
      false
    );
  });

  ["dragleave", "dragend", "drop"].forEach((evt) => {
    dz.addEventListener(
      evt,
      (e) => {
        stop(e);
        dz.classList.remove("is-dragover");
      },
      false
    );
  });

  dz.addEventListener(
    "drop",
    (e) => {
      const dt = e.dataTransfer;
      if (!dt || !dt.files) return;
      applyNewFiles(dt.files, { append: true });
    },
    false
  );

  // Initialize
  renderFileList();
  updateConvertButton();
})();

// ===== Conversion logic =====
(function () {
  const { jsPDF } = window.jspdf || {};
  const fileInput = document.getElementById("file-uploader");
  const errorMessage = document.getElementById("error-message");
  const convertButton = document.getElementById("convert-btn");

  function getMode() {
    const r = document.querySelector('input[name="conversion"]:checked');
    return r ? r.value : "pdf-to-jpg";
  }

  // Fit image onto A4
  function addImageAsPage(pdf, img, mime) {
    const pageW = 210;
    const pageH = 297;
    const imgRatio = img.width / img.height;
    const pageRatio = pageW / pageH;

    let w, h, x, y;

    if (imgRatio > pageRatio) {
      // limit by width
      w = pageW;
      h = w / imgRatio;
      x = 0;
      y = (pageH - h) / 2;
    } else {
      // limit by height
      h = pageH;
      w = h * imgRatio;
      x = (pageW - w) / 2;
      y = 0;
    }

    pdf.addImage(img, mime === "image/png" ? "PNG" : "JPEG", x, y, w, h);
  }

  async function jpgsToSinglePdf(files) {
    const pdf = new jsPDF("p", "mm", "a4");
    let first = true;

    for (const file of files) {
      const ext = file.name.toLowerCase().split(".").pop();
      if (!/(jpg|jpeg|png)$/.test(ext)) continue;

      const imgData = await fileToDataURL(file);
      const img = await loadImage(imgData);

      if (!first) pdf.addPage();
      addImageAsPage(
        pdf,
        img,
        file.type || (ext === "png" ? "image/png" : "image/jpeg")
      );
      first = false;
    }

    pdf.save("images_combined.pdf");
  }

  async function pdfToJpgs(files) {
    for (const file of files) {
      const base = file.name.replace(/\.[^.]+$/, "");
      const buffer = await fileToArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
        .promise;

      const totalPages = pdf.numPages;

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // quality

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg");

        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${base}_page_${i}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function getCurrentFiles() {
    // Prefer our authoritative list (keeps removals),
    // fallback to input.files
    return Array.from(window.__currentFiles || fileInput.files || []);
  }

  async function handleConvert() {
    errorMessage.textContent = "";

    const files = getCurrentFiles();
    if (!files.length) {
      errorMessage.textContent = "Please select at least one file.";
      return;
    }

    convertButton.disabled = true;
    const originalText = convertButton.textContent;
    convertButton.textContent = "Converting…";

    try {
      const mode = getMode();

      if (mode === "jpg-to-pdf") {
        const imgs = files.filter(
          (f) =>
            /image\/jpeg|image\/png/.test(f.type) ||
            /\.(jpg|jpeg|png)$/i.test(f.name)
        );
        if (!imgs.length) throw new Error("No JPG/PNG images found.");
        await jpgsToSinglePdf(imgs);
      } else {
        const pdfs = files.filter(
          (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
        );
        if (!pdfs.length) throw new Error("No PDF files found.");
        await pdfToJpgs(pdfs);
      }
    } catch (e) {
      console.error(e);
      errorMessage.textContent = e.message || "Conversion failed.";
    } finally {
      // After converting, empty the uploader and disable button
      try {
        window.__currentFiles = [];
        const dt = new DataTransfer();
        fileInput.files = dt.files;

        const list = document.getElementById("file-list");
        const err = document.getElementById("error-message");
        if (list) list.innerHTML = "";
        if (err) err.textContent = "";

        convertButton.disabled = true;
      } catch (e) {
        /* no-op */
      }

      convertButton.textContent = originalText;
    }
  }

  if (convertButton) {
    convertButton.addEventListener("click", handleConvert);
  }
})();
