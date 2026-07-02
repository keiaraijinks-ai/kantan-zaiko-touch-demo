/* ==========================
  かんたん在庫タッチ Ver1.0 Demo
========================== */

const STORAGE_KEYS = {
  products: "kzt_products_v1",
  histories: "kzt_takeout_histories_v1",
  inboundHistories: "kzt_inbound_histories_v1",
  categories: "kzt_categories_v1"
};

let products = loadJSON(STORAGE_KEYS.products, []);
let histories = loadJSON(STORAGE_KEYS.histories, []);
let inboundHistories = loadJSON(STORAGE_KEYS.inboundHistories, []);
let categories = loadJSON(STORAGE_KEYS.categories, []);
let selectedItems = {};
let currentCategory = "すべて";

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveAll() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
  localStorage.setItem(STORAGE_KEYS.histories, JSON.stringify(histories));
  localStorage.setItem(STORAGE_KEYS.inboundHistories, JSON.stringify(inboundHistories));
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
}

function getNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function makeId(prefix) {
  return prefix + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");

  if (screenId === "takeoutScreen") {
    renderCategories();
    renderProducts(currentCategory);
  }

  if (screenId === "stockScreen") renderStockList("all");
  if (screenId === "inboundScreen") renderInboundList();
  if (screenId === "categoryScreen") renderCategoryManageList();
}

function ensureCategories() {
  const productCategories = products.map(p => p.category || "その他");
  categories = [...new Set([...categories, ...productCategories, "事務用品", "衛生用品", "清掃用品"])];
  saveAll();
}

function renderCategories() {
  ensureCategories();

  const allCategories = ["すべて", ...categories];
  const area = document.getElementById("categoryButtons");

  area.innerHTML = allCategories.map(category => `
    <button class="${category === currentCategory ? "active-category" : ""}" onclick="setCategory('${escapeAttr(category)}')">${escapeHTML(category)}</button>
  `).join("");
}

function setCategory(category) {
  currentCategory = category;
  renderCategories();
  renderProducts(category);
}

function renderProducts(category = "すべて") {
  const list = document.getElementById("productList");
  const filtered = category === "すべて"
    ? products
    : products.filter(p => p.category === category);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="stock-item"><h3>商品がありません</h3><p>管理者メニューから商品を登録してください。</p></div>`;
    updateOrderSummary();
    return;
  }

  list.innerHTML = filtered.map(product => {
    const count = selectedItems[product.id] || 0;
    const lowStock = Number(product.stock) <= Number(product.minStock);

    return `
      <div class="product-card ${lowStock ? "low-stock" : ""} ${count > 0 ? "selected" : ""}">
        ${product.image
          ? `<img src="${product.image}" alt="${escapeAttr(product.name)}">`
          : `<div class="no-image">画像なし</div>`
        }

        <h3>${escapeHTML(product.name)}</h3>
        <p class="stock">在庫：${product.stock}${escapeHTML(product.unit)}</p>

        ${lowStock ? `<p class="alert">発注が必要</p>` : ""}

        <div class="takeout-control">
          <button onclick="changeItemCount('${product.id}', -1)">－</button>
          <span class="takeout-count">${count}</span>
          <button onclick="changeItemCount('${product.id}', 1)">＋</button>
        </div>
      </div>
    `;
  }).join("");

  updateOrderSummary();
}

function changeItemCount(productId, amount) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const current = selectedItems[productId] || 0;
  const next = current + amount;

  if (next < 0) return;

  if (next > Number(product.stock)) {
    alert("在庫数を超えて選択できません。");
    return;
  }

  if (next === 0) delete selectedItems[productId];
  else selectedItems[productId] = next;

  renderProducts(currentCategory);
}

function updateOrderSummary() {
  const typeEl = document.getElementById("selectedItemTypes");
  const totalEl = document.getElementById("selectedItemTotal");
  if (!typeEl || !totalEl) return;

  const types = Object.keys(selectedItems).length;
  const total = Object.values(selectedItems).reduce((sum, n) => sum + Number(n), 0);

  typeEl.textContent = types;
  totalEl.textContent = total;
}

function clearSelectedItems() {
  selectedItems = {};
  renderProducts(currentCategory);
}

function confirmTakeoutBatch() {
  const ids = Object.keys(selectedItems);

  if (ids.length === 0) {
    alert("持ち出す商品を選択してください。");
    return;
  }

  const now = getNow();
  let completeHtml = "<ul>";

  ids.forEach(id => {
    const product = products.find(p => p.id === id);
    const quantity = Number(selectedItems[id]);

    if (!product || quantity <= 0) return;

    product.stock = Number(product.stock) - quantity;
    product.totalTaken = Number(product.totalTaken || 0) + quantity;
    product.updatedAt = now;

    histories.push({
      id: makeId("h"),
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      unit: product.unit,
      stockAfter: product.stock,
      createdAt: now
    });

    completeHtml += `
      <li>
        ${escapeHTML(product.name)}：${quantity}${escapeHTML(product.unit)}
        <br>残り在庫：${product.stock}${escapeHTML(product.unit)}
      </li>
    `;
  });

  completeHtml += "</ul>";

  saveAll();
  selectedItems = {};

  document.getElementById("completeList").innerHTML = completeHtml;
  showScreen("completeScreen");
}

function openProductForm() {
  resetProductForm();
  renderCategoryOptions();
  showScreen("productFormScreen");
}

function renderCategoryOptions(selected = "") {
  ensureCategories();
  const select = document.getElementById("productCategory");
  select.innerHTML = categories.map(cat => `
    <option value="${escapeAttr(cat)}" ${cat === selected ? "selected" : ""}>${escapeHTML(cat)}</option>
  `).join("");
}

function saveProduct() {
  const id = document.getElementById("productId").value;
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value.trim() || "その他";
  const stock = Number(document.getElementById("productStock").value || 0);
  const minStock = Number(document.getElementById("productMinStock").value || 0);
  const unit = document.getElementById("productUnit").value.trim() || "個";
  const imageFile = document.getElementById("productImage").files[0];

  if (!name) {
    alert("商品名を入力してください。");
    return;
  }

  if (stock < 0 || minStock < 0) {
    alert("在庫数と最低在庫数は0以上で入力してください。");
    return;
  }

  const finishSave = (imageData = null) => {
    const now = getNow();

    if (!categories.includes(category)) categories.push(category);

    if (id) {
      const product = products.find(p => p.id === id);
      if (!product) return;

      product.name = name;
      product.category = category;
      product.stock = stock;
      product.minStock = minStock;
      product.unit = unit;
      product.updatedAt = now;

      if (imageData !== null) product.image = imageData;
    } else {
      products.push({
        id: makeId("p"),
        name,
        category,
        image: imageData || "",
        stock,
        minStock,
        unit,
        totalTaken: 0,
        createdAt: now,
        updatedAt: now
      });
    }

    saveAll();
    alert("商品を保存しました。");
    showScreen("adminScreen");
  };

  if (imageFile) resizeImage(imageFile, 900, 0.82, finishSave);
  else finishSave(null);
}

function resizeImage(file, maxSize, quality, callback) {
  const reader = new FileReader();

  reader.onload = event => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;

      if (w > h && w > maxSize) {
        h = Math.round(h * maxSize / w);
        w = maxSize;
      } else if (h >= w && h > maxSize) {
        w = Math.round(w * maxSize / h);
        h = maxSize;
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      callback(canvas.toDataURL("image/jpeg", quality));
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

function resetProductForm() {
  document.getElementById("productId").value = "";
  document.getElementById("productName").value = "";
  document.getElementById("productImage").value = "";
  document.getElementById("productStock").value = "";
  document.getElementById("productMinStock").value = "";
  document.getElementById("productUnit").value = "";
  document.getElementById("formTitle").textContent = "商品登録";
}

function renderStockList(type = "all") {
  const list = document.getElementById("stockList");

  const filtered = type === "alert"
    ? products.filter(p => Number(p.stock) <= Number(p.minStock))
    : products;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="stock-item"><h3>表示する商品がありません</h3></div>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <div class="stock-item ${Number(p.stock) <= Number(p.minStock) ? "low-stock" : ""}">
      <h3>${escapeHTML(p.name)}</h3>
      <p>カテゴリ：${escapeHTML(p.category)}</p>
      <p>現在在庫：${p.stock}${escapeHTML(p.unit)}</p>
      <p>最低在庫：${p.minStock}${escapeHTML(p.unit)}</p>
      <p>持ち出し合計：${Number(p.totalTaken || 0)}${escapeHTML(p.unit)}</p>
      ${Number(p.stock) <= Number(p.minStock) ? `<p class="alert">発注が必要</p>` : ""}
    </div>
  `).join("");
}

function renderEditProductList() {
  const list = document.getElementById("editProductList");

  if (products.length === 0) {
    list.innerHTML = `<div class="stock-item"><h3>商品がありません</h3></div>`;
  } else {
    list.innerHTML = products.map(p => `
      <div class="stock-item ${Number(p.stock) <= Number(p.minStock) ? "low-stock" : ""}">
        <h3>${escapeHTML(p.name)}</h3>
        <p>カテゴリ：${escapeHTML(p.category)}</p>
        <p>在庫：${p.stock}${escapeHTML(p.unit)}</p>
        <div class="item-actions">
          <button class="edit-button" onclick="editProduct('${p.id}')">編集</button>
          <button class="delete-button" onclick="deleteProduct('${p.id}')">削除</button>
        </div>
      </div>
    `).join("");
  }

  showScreen("editProductScreen");
}

function editProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  document.getElementById("productId").value = product.id;
  document.getElementById("productName").value = product.name;
  renderCategoryOptions(product.category);
  document.getElementById("productStock").value = product.stock;
  document.getElementById("productMinStock").value = product.minStock;
  document.getElementById("productUnit").value = product.unit;
  document.getElementById("productImage").value = "";
  document.getElementById("formTitle").textContent = "商品編集";

  showScreen("productFormScreen");
}

function deleteProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const ok = confirm(`「${product.name}」を削除しますか？\n履歴は残ります。`);
  if (!ok) return;

  products = products.filter(p => p.id !== id);
  delete selectedItems[id];
  saveAll();
  renderEditProductList();
}

function renderInboundList() {
  const list = document.getElementById("inboundList");

  if (products.length === 0) {
    list.innerHTML = `<div class="stock-item"><h3>商品がありません</h3></div>`;
    return;
  }

  list.innerHTML = products.map(p => `
    <div class="stock-item">
      <h3>${escapeHTML(p.name)}</h3>
      <p>現在在庫：${p.stock}${escapeHTML(p.unit)}</p>
      <div class="inbound-control">
        <button onclick="changeInboundCount('${p.id}', -1)">－</button>
        <span id="inbound-${p.id}" class="inbound-count">0</span>
        <button onclick="changeInboundCount('${p.id}', 1)">＋</button>
      </div>
      <button class="confirm-button" onclick="confirmInbound('${p.id}')">この商品を入庫</button>
    </div>
  `).join("");
}

function changeInboundCount(id, amount) {
  const el = document.getElementById(`inbound-${id}`);
  if (!el) return;

  const current = Number(el.textContent || 0);
  const next = Math.max(0, current + amount);
  el.textContent = next;
}

function confirmInbound(id) {
  const product = products.find(p => p.id === id);
  const el = document.getElementById(`inbound-${id}`);
  if (!product || !el) return;

  const quantity = Number(el.textContent || 0);

  if (quantity <= 0) {
    alert("入庫数を選択してください。");
    return;
  }

  const now = getNow();
  product.stock = Number(product.stock) + quantity;
  product.updatedAt = now;

  inboundHistories.push({
    id: makeId("i"),
    productId: product.id,
    productName: product.name,
    category: product.category,
    quantity,
    unit: product.unit,
    stockAfter: product.stock,
    createdAt: now
  });

  saveAll();
  alert(`${product.name}を${quantity}${product.unit}入庫しました。`);
  renderInboundList();
}

function addCategory() {
  const input = document.getElementById("newCategoryName");
  const name = input.value.trim();

  if (!name) {
    alert("カテゴリ名を入力してください。");
    return;
  }

  if (categories.includes(name)) {
    alert("同じカテゴリがすでにあります。");
    return;
  }

  categories.push(name);
  input.value = "";
  saveAll();
  renderCategoryManageList();
}

function renderCategoryManageList() {
  ensureCategories();

  const list = document.getElementById("categoryManageList");
  list.innerHTML = categories.map(cat => {
    const used = products.some(p => p.category === cat);
    return `
      <div class="stock-item">
        <h3>${escapeHTML(cat)}</h3>
        <p>${used ? "使用中の商品があります" : "未使用カテゴリ"}</p>
        <button class="danger-button" onclick="deleteCategory('${escapeAttr(cat)}')" ${used ? "disabled style='opacity:.4'" : ""}>削除</button>
      </div>
    `;
  }).join("");
}

function deleteCategory(category) {
  const used = products.some(p => p.category === category);
  if (used) {
    alert("このカテゴリは商品で使用中のため削除できません。");
    return;
  }

  const ok = confirm(`カテゴリ「${category}」を削除しますか？`);
  if (!ok) return;

  categories = categories.filter(c => c !== category);
  saveAll();
  renderCategoryManageList();
}

function renderAlertList() {
  const list = document.getElementById("alertList");
  const alerts = products.filter(p => Number(p.stock) <= Number(p.minStock));

  if (alerts.length === 0) {
    list.innerHTML = `<div class="stock-item"><h3>発注が必要な商品はありません</h3></div>`;
  } else {
    list.innerHTML = alerts.map(p => `
      <div class="stock-item low-stock">
        <h3>${escapeHTML(p.name)}</h3>
        <p>カテゴリ：${escapeHTML(p.category)}</p>
        <p>現在在庫：${p.stock}${escapeHTML(p.unit)}</p>
        <p>最低在庫：${p.minStock}${escapeHTML(p.unit)}</p>
        <p class="alert">発注が必要</p>
      </div>
    `).join("");
  }

  showScreen("alertScreen");
}

function exportStockCSV() {
  const header = ["商品名", "カテゴリ", "現在在庫", "最低在庫", "持ち出し合計", "単位", "発注状態", "最終更新日"];
  const rows = products.map(p => [
    p.name,
    p.category,
    p.stock,
    p.minStock,
    p.totalTaken || 0,
    p.unit,
    Number(p.stock) <= Number(p.minStock) ? "発注が必要" : "通常",
    p.updatedAt || ""
  ]);

  downloadCSV("在庫一覧.csv", [header, ...rows]);
}

function exportHistoryCSV() {
  const header = ["日時", "商品名", "カテゴリ", "持ち出し数", "単位", "持ち出し後在庫"];
  const rows = histories.map(h => [
    h.createdAt,
    h.productName,
    h.category || "",
    h.quantity,
    h.unit,
    h.stockAfter
  ]);

  downloadCSV("持ち出し履歴.csv", [header, ...rows]);
}

function exportInboundCSV() {
  const header = ["日時", "商品名", "カテゴリ", "入庫数", "単位", "入庫後在庫"];
  const rows = inboundHistories.map(h => [
    h.createdAt,
    h.productName,
    h.category || "",
    h.quantity,
    h.unit,
    h.stockAfter
  ]);

  downloadCSV("入庫履歴.csv", [header, ...rows]);
}

function downloadCSV(filename, rows) {
  const csv = rows.map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str) {
  return escapeHTML(str).replace(/`/g, "&#096;");
}

function initSampleData() {
  if (products.length > 0) return;

  const now = getNow();

  categories = ["事務用品", "衛生用品", "清掃用品", "介護用品"];

  products = [
    {
      id: "p001",
      name: "コピー用紙",
      category: "事務用品",
      image: "",
      stock: 20,
      minStock: 5,
      unit: "箱",
      totalTaken: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "p002",
      name: "ボールペン",
      category: "事務用品",
      image: "",
      stock: 50,
      minStock: 10,
      unit: "本",
      totalTaken: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "p003",
      name: "手袋",
      category: "衛生用品",
      image: "",
      stock: 8,
      minStock: 10,
      unit: "箱",
      totalTaken: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "p004",
      name: "洗剤",
      category: "清掃用品",
      image: "",
      stock: 12,
      minStock: 3,
      unit: "本",
      totalTaken: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "p005",
      name: "マスク",
      category: "衛生用品",
      image: "",
      stock: 25,
      minStock: 10,
      unit: "箱",
      totalTaken: 0,
      createdAt: now,
      updatedAt: now
    }
  ];

  saveAll();
}

initSampleData();
ensureCategories();
renderCategories();
renderProducts("すべて");
