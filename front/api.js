const API_BASE_URL = "https://fakestoreapi.com";
const CART_STORAGE_KEY = "eshop-cart";

function createEmptyCartState() {
  return {
    remoteCartId: null,
    items: [],
  };
}

function readCartState() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return createEmptyCartState();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) {
      return createEmptyCartState();
    }

    return {
      remoteCartId: parsed.remoteCartId ?? null,
      items: parsed.items.map((item) => ({
        id: Number(item.id),
        title: String(item.title),
        price: Number(item.price),
        image: String(item.image),
        category: String(item.category),
        quantity: Number(item.quantity),
      })),
    };
  } catch (error) {
    console.warn("Nepavyko nuskaityti krepšelio būsenos.", error);
    return createEmptyCartState();
  }
}

function writeCartState(state) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state));
  return state;
}

function buildUrl(path, query = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function apiRequest(path, { method = "GET", query, body } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API klaida: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function normalizeProduct(product) {
  return {
    id: Number(product.id),
    title: product.title,
    price: Number(product.price),
    description: product.description,
    category: product.category,
    image: product.image,
    rating: Number(product.rating?.rate ?? 0),
    reviewCount: Number(product.rating?.count ?? 0),
  };
}

function mapCartProducts(items) {
  return items.map((item) => ({
    productId: Number(item.id),
    quantity: Number(item.quantity),
  }));
}

async function createRemoteCart(items) {
  return apiRequest("/carts", {
    method: "POST",
    body: {
      userId: 2,
      date: new Date().toISOString().split("T")[0],
      products: mapCartProducts(items),
    },
  });
}

async function updateRemoteCart(remoteCartId, items) {
  return apiRequest(`/carts/${remoteCartId}`, {
    method: "PUT",
    body: {
      userId: 2,
      date: new Date().toISOString().split("T")[0],
      products: mapCartProducts(items),
    },
  });
}

async function deleteRemoteCart(remoteCartId) {
  return apiRequest(`/carts/${remoteCartId}`, {
    method: "DELETE",
  });
}

async function syncCartWithApi(state) {
  try {
    if (!state.items.length) {
      if (state.remoteCartId) {
        await deleteRemoteCart(state.remoteCartId);
      }

      const clearedState = {
        remoteCartId: null,
        items: [],
      };

      writeCartState(clearedState);
      return { cart: clearedState, syncError: null };
    }

    if (state.remoteCartId) {
      await updateRemoteCart(state.remoteCartId, state.items);
      return { cart: state, syncError: null };
    }

    const remoteCart = await createRemoteCart(state.items);
    const nextState = {
      ...state,
      remoteCartId: remoteCart?.id ?? null,
    };

    writeCartState(nextState);
    return { cart: nextState, syncError: null };
  } catch (error) {
    console.warn("Nepavyko susinchronizuoti krepšelio su FakeStoreAPI.", error);
    return { cart: state, syncError: error };
  }
}

export async function fetchProducts({ limit = 25, sort = "desc" } = {}) {
  const products = await apiRequest("/products", {
    query: { limit, sort },
  });

  return products.map(normalizeProduct);
}

export async function fetchCategories() {
  try {
    return await apiRequest("/products/categories");
  } catch (error) {
    return apiRequest("/products/products/categories");
  }
}

export async function fetchProductsByCategory(category, { limit = 25, sort = "desc" } = {}) {
  const products = await apiRequest(`/products/category/${encodeURIComponent(category)}`, {
    query: { limit, sort },
  });

  return products.map(normalizeProduct);
}

export async function fetchProductById(productId) {
  const product = await apiRequest(`/products/${productId}`);
  return normalizeProduct(product);
}

export function getCartSnapshot() {
  return readCartState();
}

export function getCartItemCount() {
  return readCartState().items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotals() {
  const cart = readCartState();
  const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cart.items.length ? 4.99 : 0;
  const total = subtotal + shipping;

  return { subtotal, shipping, total };
}

export async function addProductToCart(product) {
  const state = readCartState();
  const existingItem = state.items.find((item) => item.id === product.id);

  let nextItems;
  if (existingItem) {
    nextItems = state.items.map((item) =>
      item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
    );
  } else {
    nextItems = [
      ...state.items,
      {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        quantity: 1,
      },
    ];
  }

  const nextState = writeCartState({
    ...state,
    items: nextItems,
  });

  return syncCartWithApi(nextState);
}

export async function setCartItemQuantity(productId, quantity) {
  const state = readCartState();
  const normalizedQuantity = Math.max(0, Math.min(99, Number(quantity) || 0));

  const nextItems = normalizedQuantity
    ? state.items.map((item) =>
        item.id === Number(productId) ? { ...item, quantity: normalizedQuantity } : item
      )
    : state.items.filter((item) => item.id !== Number(productId));

  const nextState = writeCartState({
    ...state,
    items: nextItems,
  });

  return syncCartWithApi(nextState);
}

export async function removeCartItem(productId) {
  return setCartItemQuantity(productId, 0);
}

export async function clearCart() {
  return syncCartWithApi({
    ...readCartState(),
    items: [],
  });
}
