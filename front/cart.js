import {
  clearCart,
  getCartItemCount,
  getCartSnapshot,
  getCartTotals,
  removeCartItem,
  setCartItemQuantity,
} from "./api.js";

const elements = {};

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

function updateCartBadge() {
  elements.cartCount.textContent = getCartItemCount();
}

function cartItemHtml(item) {
  return `
    <article class="card border-0 shadow-sm rounded-4">
      <div class="card-body">
        <div class="row g-3 align-items-center">
          <div class="col-12 col-md-2 text-center">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="cart-item-image img-fluid">
          </div>
          <div class="col-12 col-md-5">
            <span class="badge text-bg-light border mb-2">${escapeHtml(item.category)}</span>
            <h2 class="h6 mb-1">${escapeHtml(item.title)}</h2>
            <p class="text-muted mb-0">Vieneto kaina: ${formatPrice(item.price)}</p>
          </div>
          <div class="col-7 col-md-3">
            <label class="form-label small text-muted mb-1">Kiekis</label>
            <div class="input-group input-group-sm">
              <button class="btn btn-outline-secondary" data-action="decrease" data-product-id="${item.id}">-</button>
              <input class="form-control text-center" type="number" min="1" max="99" value="${item.quantity}" data-action="quantity" data-product-id="${item.id}">
              <button class="btn btn-outline-secondary" data-action="increase" data-product-id="${item.id}">+</button>
            </div>
          </div>
          <div class="col-5 col-md-2 text-md-end">
            <div class="fw-semibold mb-2">${formatPrice(item.price * item.quantity)}</div>
            <button class="btn btn-link text-danger p-0" data-action="remove" data-product-id="${item.id}">
              Pašalinti
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderCart() {
  const cart = getCartSnapshot();
  const totals = getCartTotals();

  updateCartBadge();

  if (!cart.items.length) {
    elements.cartItems.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4">
        <div class="card-body text-center py-5">
          <h2 class="h4 mb-3">Krepšelis tuščias</h2>
          <p class="text-muted mb-4">Įsidėk bent vieną prekę iš katalogo, kad galėtum tęsti.</p>
          <a href="shop.html" class="btn btn-dark">Grįžti į katalogą</a>
        </div>
      </div>
    `;

    elements.summary.innerHTML = `
      <div class="card border-0 shadow-sm rounded-4">
        <div class="card-body">
          <h2 class="h5 mb-3">Santrauka</h2>
          <p class="text-muted mb-0">Šiuo metu krepšelyje nėra prekių.</p>
        </div>
      </div>
    `;
    return;
  }

  elements.cartItems.innerHTML = cart.items.map(cartItemHtml).join("");
  elements.summary.innerHTML = `
    <div class="card border-0 shadow-sm rounded-4">
      <div class="card-body">
        <h2 class="h5 mb-4">Užsakymo santrauka</h2>
        <div class="d-flex justify-content-between mb-2">
          <span class="text-muted">Prekės</span>
          <span>${formatPrice(totals.subtotal)}</span>
        </div>
        <div class="d-flex justify-content-between mb-3">
          <span class="text-muted">Pristatymas</span>
          <span>${formatPrice(totals.shipping)}</span>
        </div>
        <div class="d-flex justify-content-between border-top pt-3 mb-4">
          <strong>Viso</strong>
          <strong>${formatPrice(totals.total)}</strong>
        </div>
        <div class="d-grid gap-2">
          <button class="btn btn-dark" id="checkoutButton">Tęsti pirkimą</button>
          <button class="btn btn-outline-danger" id="clearCartButton">Išvalyti krepšelį</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("checkoutButton")?.addEventListener("click", () => {
    showNotice("Užsakyta!", "info");
  });

  document.getElementById("clearCartButton")?.addEventListener("click", async () => {
    const result = await clearCart();
    renderCart();

    if (result.syncError) {
      showNotice("Krepšelis išvalytas lokaliai, bet DELETE į FakeStoreAPI nepavyko.", "warning");
      return;
    }

    showNotice("Krepšelis išvalytas.", "success");
  });
}

async function handleCartAction(action, productId, currentValue) {
  const cart = getCartSnapshot();
  const currentItem = cart.items.find((item) => item.id === Number(productId));
  if (!currentItem) {
    return;
  }

  let result;

  if (action === "increase") {
    result = await setCartItemQuantity(productId, currentItem.quantity + 1);
  }

  if (action === "decrease") {
    result = await setCartItemQuantity(productId, currentItem.quantity - 1);
  }

  if (action === "quantity") {
    result = await setCartItemQuantity(productId, currentValue);
  }

  if (action === "remove") {
    result = await removeCartItem(productId);
  }

  renderCart();

  if (!result) {
    return;
  }

  if (result.syncError) {
    showNotice("Krepšelis atnaujintas lokaliai, bet FakeStoreAPI sinchronizacija nepavyko.", "warning");
    return;
  }

  showNotice("Krepšelio būsena atnaujinta.", "success");
}

function bindEvents() {
  elements.cartItems.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const productId = Number(button.dataset.productId);

    if (action === "increase" || action === "decrease" || action === "remove") {
      await handleCartAction(action, productId);
    }
  });

  elements.cartItems.addEventListener("change", async (event) => {
    if (event.target.dataset.action !== "quantity") {
      return;
    }

    const productId = Number(event.target.dataset.productId);
    await handleCartAction("quantity", productId, event.target.value);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  elements.notice = document.getElementById("notice");
  elements.cartCount = document.getElementById("cartCount");
  elements.cartItems = document.getElementById("cartItems");
  elements.summary = document.getElementById("summary");

  renderCart();
  bindEvents();
});
