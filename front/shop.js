// ── STATE ─────────────────────────────────────────────────────
const state = {
  products: [],
  categories: [],
  filters: {
    activeCategory: "visi",
    priceMin: "",
    priceMax: "",
    onlyInStock: false,
    search: ""
  },
  cartCount: 0
};

const categoryLabels = {
  drabuziai: "Drabužiai",
  virtuve: "Virtuvė",
  elektronika: "Elektronika",
  knygos: "Knygos",
  avalyne: "Avalynė",
  aksesuarai: "Aksesuarai",
  sportas: "Sportas",
  namai: "Namai"
};

// DATA LOADING
// ════════════════════════════════════════════════════════════

/**
 * Fetch products data from JSON file
 * @returns {Promise<Array>} Array of product objects
 */
async function fetchProductsData() {
  const sources = ["../back/products.json", "/back/products.json", "back/products.json"];
  let lastError = "";

  for (const source of sources) {
    try {
      const res = await fetch(source, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      lastError = `${source} -> ${res.status}`;
    } catch (err) {
      lastError = `${source} -> ${err?.message || "fetch klaida"}`;
    }
  }

  throw new Error(`Nepavyko rasti products.json. ${lastError}`);
}

/**
 * Initialize app with fetched products data
 * @param {Array} productsData - Array of products from JSON
 */
function initializeApp(productsData) {
  state.products = productsData;
  state.categories = [...new Set(productsData.map((p) => p.cat).filter(Boolean))];
  
  renderFilters();
  renderProducts();
  updateCartCount();
}

/**
 * Load and initialize the application
 */
async function loadProducts() {
  const grid = document.getElementById("productGrid");
  
  if (window.location.protocol === "file:") {
    grid.innerHTML = `<div class="col"><p class="text-danger">Atidaryta per file://. Reikia paleisti per lokalų serverį.</p></div>`;
    return;
  }

  grid.innerHTML = '<div class="col"><p class="text-muted">Kraunamos prekės...</p></div>';

  try {
    const data = await fetchProductsData();
    initializeApp(data);
  } catch (error) {
    console.error(error);
    const help = window.location.protocol === "file:"
      ? "Paleisk per serverį (pvz.: npx serve . arba VS Code Live Server)."
      : "Patikrink products.json kelią ir ar serveris leidžia /back katalogą.";
    grid.innerHTML = `<div class="col"><p class="text-danger mb-1">Nepavyko užkrauti prekių iš products.json</p><p class="text-muted mb-0">${help}</p></div>`;
  }
}

// FILTER MANAGEMENT
// ════════════════════════════════════════════════════════════

function getCategoryLabel(cat) {
  if (categoryLabels[cat]) return categoryLabels[cat];
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function setCategory(cat) {
  state.filters.activeCategory = cat;
  renderFilters();
  renderProducts();
}

function toggleStock() {
  state.filters.onlyInStock = !state.filters.onlyInStock;
  renderFilters();
  renderProducts();
}

function setPriceMin(value) {
  state.filters.priceMin = value;
  renderProducts();
}

function setPriceMax(value) {
  state.filters.priceMax = value;
  renderProducts();
}

function updateSearchInput() {
  state.filters.search = (document.getElementById("searchInput")?.value || "").toLowerCase();
  renderProducts();
}

// RENDERING - FILTERS
// ════════════════════════════════════════════════════════════

/**
 * Build filter UI HTML
 * @returns {string} HTML string for filters
 */
function filtersHTML() {
  return `
    <p class="card-title mb-2">Kategorija</p>
    <div class="d-flex flex-column gap-1 mb-3">
      ${["visi", ...state.categories].map(c => `
        <button class="btn btn-sm text-start ${state.filters.activeCategory === c ? "btn-dark" : "btn-outline-secondary"}"
          onclick="setCategory('${c}')">
          ${c === "visi" ? "Visi" : getCategoryLabel(c)}
        </button>
      `).join("")}
    </div>

    <p class="card-title mb-2">Kaina</p>
    <div class="d-flex gap-2 align-items-center mb-3">
      <input type="number" class="form-control form-control-sm" placeholder="Nuo" id="priceMin" 
        value="${state.filters.priceMin}" oninput="setPriceMin(this.value)" style="width:70px">
      <span class="text-muted">-</span>
      <input type="number" class="form-control form-control-sm" placeholder="Iki" id="priceMax" 
        value="${state.filters.priceMax}" oninput="setPriceMax(this.value)" style="width:70px">
    </div>

    <p class="card-title mb-2">Kiekis</p>
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="stockCheck" 
        ${state.filters.onlyInStock ? "checked" : ""} onchange="toggleStock()">
      <label class="form-check-label" for="stockCheck">Tik turimų</label>
    </div>
  `;
}

/**
 * Render filters in both sidebar and mobile offcanvas
 */
function renderFilters() {
  const html = filtersHTML();
  const sidebar = document.getElementById("sidebarFilterBody");
  const offcanvas = document.getElementById("offcanvasFilterBody");
  
  if (sidebar) sidebar.innerHTML = html;
  if (offcanvas) offcanvas.innerHTML = html;
}

// RENDERING - PRODUCTS
// ════════════════════════════════════════════════════════════

/**
 * Filter products based on current filter state
 * @returns {Array} Filtered products array
 */
function getFilteredProducts() {
  const pmin = state.filters.priceMin !== "" ? parseFloat(state.filters.priceMin) : 0;
  const pmax = state.filters.priceMax !== "" ? parseFloat(state.filters.priceMax) : Infinity;

  return state.products.filter((p) => {
    if (state.filters.activeCategory !== "visi" && p.cat !== state.filters.activeCategory) return false;
    if (state.filters.onlyInStock && p.stock === 0) return false;
    if (p.price < pmin || p.price > pmax) return false;
    if (state.filters.search && !p.name.toLowerCase().includes(state.filters.search)) return false;
    return true;
  });
}

/**
 * Sort products based on selected sorting option
 * @param {Array} products - Products to sort
 * @returns {Array} Sorted products
 */
function getSortedProducts(products) {
  const sort = document.getElementById("sortSelect")?.value || "new";
  const sorted = [...products];

  if (sort === "asc") sorted.sort((a, b) => a.price - b.price);
  if (sort === "desc") sorted.sort((a, b) => b.price - a.price);

  return sorted;
}

/**
 * Build product card HTML
 * @param {Object} product - Product object
 * @returns {string} HTML string for product card
 */
function productCardHTML(product) {
  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;
  
    let stockDisplay = "";
  if (outOfStock) {
    stockDisplay = `<small class="d-block text-danger fw-bold mb-1">❌ Išparduota</small>`;
  } else if (lowStock) {
    stockDisplay = `<small class="d-block text-warning fw-bold mb-1">⚠️ Liko ${product.stock} vnt.</small>`;
  } else {
    stockDisplay = `<small class="d-block text-success mb-1">✅ Yra: ${product.stock} vnt.</small>`;
  }

  return `
    <div class="col-6 col-md-4 col-lg-3">
      <div class="card product-card h-100 border-0 shadow-sm ${outOfStock ? "out-of-stock" : ""}">
        <div class="card-img-top" style="background:${product.bg}; color: #333;">
          ${product.icon}
        </div>
        <div class="card-body d-flex flex-column">
          <span class="badge bg-secondary badge-cat mb-1 align-self-start">
            ${getCategoryLabel(product.cat)}
          </span>
          <h6 class="card-title">${product.name}</h6>
          
          ${stockDisplay}
          
          <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
            <span class="price fw-bold text-success">${product.price.toFixed(2)} €</span>
            <button class="btn btn-sm btn-outline-dark"
              ${outOfStock ? "disabled" : ""}
              onclick="addToCart(${product.id}, '${product.name}')">
              ${outOfStock ? "❌ Išparduota" : "🛒 Dėti"}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render products list based on filters and sorting
 */
function renderProducts() {
  const filtered = getFilteredProducts();
  const sorted = getSortedProducts(filtered);

  const resultCount = document.getElementById("resultCount");
  const productGrid = document.getElementById("productGrid");

  if (resultCount) {
    resultCount.textContent = sorted.length;
  }

  if (productGrid) {
    productGrid.innerHTML = 
      sorted.length > 0 
        ? sorted.map(productCardHTML).join("")
        : '<div class="col-12"><p class="text-muted text-center">Prekių nerasta.</p></div>';
  }
}

// CART MANAGEMENT
// ════════════════════════════════════════════════════════════

function addToCart(id, name) {
  state.cartCount++;
  updateCartCount();
  showToast(`✅ "${name}" pridėta į krepšelį!`);
}

function updateCartCount() {
  const cartBadge = document.getElementById("cartCount");
  if (cartBadge) {
    cartBadge.textContent = state.cartCount;
  }
}

function showToast(message) {
  // Simple toast notification (optional enhancement)
  console.log(message);
}

// INITIALIZATION
// ════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  
  // Handle search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", updateSearchInput);
  }
});