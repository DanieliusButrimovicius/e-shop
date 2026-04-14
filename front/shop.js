import {
  addProductToCart,
  fetchCategories,
  fetchProductById,
  fetchProducts,
  fetchProductsByCategory,
  getCartItemCount,
} from "./api.js";

const state = {
  products: [],
  categories: [],
  filters: {
    category: "all",
    priceMin: "",
    priceMax: "",
    search: "",
  },
  sort: "desc",
  limit: 25,
};

const elements = {};
let detailsModal = null;

function formatPrice(price) {
  return `${price.toFixed(2)} €`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showNotice(message, tone = "secondary") {
  elements.notice.innerHTML = `
    <div class="alert alert-${tone} mb-0" role="alert">
      ${escapeHtml(message)}
    </div>
  `;
}

function clearNotice() {
  elements.notice.innerHTML = "";
}

function updateCartBadge() {
  elements.cartCount.textContent = getCartItemCount();
}

function getVisibleProducts() {
  const minPrice = state.filters.priceMin === "" ? 0 : Number(state.filters.priceMin);
  const maxPrice = state.filters.priceMax === "" ? Infinity : Number(state.filters.priceMax);
  const search = state.filters.search.trim().toLowerCase();

  return state.products.filter((product) => {
    if (product.price < minPrice || product.price > maxPrice) {
      return false;
    }

    if (search) {
      const matchesTitle = product.title.toLowerCase().includes(search);
      const matchesDescription = product.description.toLowerCase().includes(search);
      if (!matchesTitle && !matchesDescription) {
        return false;
      }
    }

    return true;
  });
}

function productCardHtml(product) {
  return `
    <div class="col-12 col-sm-6 col-xl-4">
      <article class="card product-card h-100 border-0 shadow-sm">
        <div class="product-image-wrap p-4">
          <img src="${escapeHtml(product.image)}" class="product-image" alt="${escapeHtml(product.title)}">
        </div>
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
            <span class="badge text-bg-light border text-wrap">${escapeHtml(product.category)}</span>
            <small class="text-muted text-end">${product.rating.toFixed(1)} / 5</small>
          </div>
          <h2 class="h6 mb-2">${escapeHtml(product.title)}</h2>
          <p class="text-muted small flex-grow-1 mb-3">${escapeHtml(product.description.slice(0, 110))}...</p>
          <div class="d-flex justify-content-between align-items-center mb-3">
            <strong class="price">${formatPrice(product.price)}</strong>
            <small class="text-muted">${product.reviewCount} atsil.</small>
          </div>
          <div class="d-flex gap-2 mt-auto">
            <button class="btn btn-outline-secondary btn-sm flex-fill" data-action="details" data-product-id="${product.id}">
              Peržiūrėti
            </button>
            <button class="btn btn-dark btn-sm flex-fill" data-action="add" data-product-id="${product.id}">
              Į krepšelį
            </button>
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderProducts() {
  const products = getVisibleProducts();
  elements.resultCount.textContent = products.length;

  if (!products.length) {
    elements.productGrid.innerHTML = `
      <div class="col-12">
        <div class="text-center text-muted py-5 bg-white rounded-4 border">
          Pagal pasirinktus filtrus prekių nerasta.
        </div>
      </div>
    `;
    return;
  }

  elements.productGrid.innerHTML = products.map(productCardHtml).join("");
}

function categoryButtonHtml(category) {
  const isActive = state.filters.category === category;
  const label = category === "all" ? "Visos" : category;

  return `
    <button
      type="button"
      class="btn btn-sm text-start ${isActive ? "btn-dark" : "btn-outline-secondary"}"
      data-category="${escapeHtml(category)}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function filtersHtml() {
  return `
    <p class="filter-title mb-2">Kategorija</p>
    <div class="d-grid gap-2 mb-4">
      ${["all", ...state.categories].map(categoryButtonHtml).join("")}
    </div>

    <p class="filter-title mb-2">Kaina</p>
    <div class="row g-2 mb-1">
      <div class="col-6">
        <input type="number" class="form-control form-control-sm" data-filter="priceMin" placeholder="Nuo" value="${state.filters.priceMin}">
      </div>
      <div class="col-6">
        <input type="number" class="form-control form-control-sm" data-filter="priceMax" placeholder="Iki" value="${state.filters.priceMax}">
      </div>
    </div>
    <small class="text-muted">Kainos filtras veikia lokaliai naršyklėje.</small>
  `;
}

function renderFilters() {
  const html = filtersHtml();
  elements.sidebarFilterBody.innerHTML = html;
  elements.offcanvasFilterBody.innerHTML = html;
}

async function loadProducts() {
  elements.productGrid.innerHTML = `
    <div class="col-12">
      <div class="text-center text-muted py-5 bg-white rounded-4 border">Kraunamos prekės...</div>
    </div>
  `;

  try {
    const products =
      state.filters.category === "all"
        ? await fetchProducts({ limit: state.limit, sort: state.sort })
        : await fetchProductsByCategory(state.filters.category, { limit: state.limit, sort: state.sort });

    state.products = products;
    renderProducts();
    clearNotice();
  } catch (error) {
    console.error(error);
    showNotice("Nepavyko užkrauti produktų iš FakeStoreAPI.", "danger");
    elements.productGrid.innerHTML = "";
  }
}

async function loadInitialData() {
  try {
    const [products, categories] = await Promise.all([
      fetchProducts({ limit: state.limit, sort: state.sort }),
      fetchCategories(),
    ]);

    state.products = products;
    state.categories = categories;

    renderFilters();
    renderProducts();
    updateCartBadge();
  } catch (error) {
    console.error(error);
    showNotice("Nepavyko pasiekti FakeStoreAPI. Patikrink, ar puslapis paleistas per lokalų serverį.", "danger");
    elements.productGrid.innerHTML = "";
  }
}

async function handleAddToCart(productId) {
  const product = state.products.find((item) => item.id === Number(productId));
  if (!product) {
    return;
  }

  const result = await addProductToCart(product);
  updateCartBadge();

  if (result.syncError) {
    showNotice("Prekė įdėta lokaliai, bet FakeStoreAPI sinchronizacija nepavyko.", "warning");
    return;
  }

  showNotice(`„${product.title}“ įdėta į krepšelį.`, "success");
}

async function openDetails(productId) {
  elements.modalBody.innerHTML = `
    <div class="text-center py-4 text-muted">Kraunama prekės informacija...</div>
  `;

  detailsModal.show();

  try {
    const product = await fetchProductById(productId);
    elements.modalTitle.textContent = product.title;
    elements.modalBody.innerHTML = `
      <div class="row g-4 align-items-start">
        <div class="col-12 col-md-5 text-center">
          <img src="${escapeHtml(product.image)}" class="img-fluid product-modal-image" alt="${escapeHtml(product.title)}">
        </div>
        <div class="col-12 col-md-7">
          <span class="badge text-bg-light border mb-3">${escapeHtml(product.category)}</span>
          <p class="text-muted mb-3">${escapeHtml(product.description)}</p>
          <div class="d-flex justify-content-between align-items-center border rounded-4 p-3">
            <div>
              <div class="fw-semibold">${formatPrice(product.price)}</div>
              <small class="text-muted">${product.rating.toFixed(1)} / 5 iš ${product.reviewCount} atsiliepimų</small>
            </div>
            <button class="btn btn-dark btn-sm" id="modalAddToCartButton">Į krepšelį</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("modalAddToCartButton")?.addEventListener("click", async () => {
      await handleAddToCart(product.id);
      detailsModal.hide();
    });
  } catch (error) {
    console.error(error);
    elements.modalBody.innerHTML = `
      <div class="alert alert-danger mb-0">Nepavyko užkrauti prekės detalių.</div>
    `;
  }
}

function bindStaticEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderProducts();
  });

  elements.sortSelect.addEventListener("change", async (event) => {
    state.sort = event.target.value;
    await loadProducts();
  });

  elements.sidebarFilterBody.addEventListener("click", async (event) => {
    const category = event.target.closest("[data-category]")?.dataset.category;
    if (!category) {
      return;
    }

    state.filters.category = category;
    renderFilters();
    await loadProducts();
  });

  elements.offcanvasFilterBody.addEventListener("click", async (event) => {
    const category = event.target.closest("[data-category]")?.dataset.category;
    if (!category) {
      return;
    }

    state.filters.category = category;
    renderFilters();
    await loadProducts();
  });

  document.addEventListener("input", (event) => {
    if (event.target.dataset.filter === "priceMin") {
      state.filters.priceMin = event.target.value;
      renderProducts();
    }

    if (event.target.dataset.filter === "priceMax") {
      state.filters.priceMax = event.target.value;
      renderProducts();
    }
  });

  elements.productGrid.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const productId = Number(button.dataset.productId);
    if (button.dataset.action === "add") {
      await handleAddToCart(productId);
    }

    if (button.dataset.action === "details") {
      await openDetails(productId);
    }
  });
}

function cacheElements() {
  elements.notice = document.getElementById("notice");
  elements.cartCount = document.getElementById("cartCount");
  elements.searchInput = document.getElementById("searchInput");
  elements.sortSelect = document.getElementById("sortSelect");
  elements.sidebarFilterBody = document.getElementById("sidebarFilterBody");
  elements.offcanvasFilterBody = document.getElementById("offcanvasFilterBody");
  elements.resultCount = document.getElementById("resultCount");
  elements.productGrid = document.getElementById("productGrid");
  elements.modalTitle = document.getElementById("productModalLabel");
  elements.modalBody = document.getElementById("productModalBody");
}

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  detailsModal = new bootstrap.Modal(document.getElementById("productModal"));

  bindStaticEvents();
  await loadInitialData();
});
