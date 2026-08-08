// ---- Airtable connection settings ----
const AIRTABLE_TOKEN = "patjVWplT3Tx0xUqY.bd5a714543f88802eafc51667bc414bfc6ed17bedee6a080bddad6a7d7283925";
const BASE_ID = "appnvBGNd1VskROtg";
const TABLE_NAME = "Products";

let allProducts = [];

const productGrid = document.getElementById("productGrid");
const loadingMsg = document.getElementById("loadingMsg");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

async function fetchAllProducts() {
  let records = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?pageSize=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable request failed: ${response.status}`);
    }

    const data = await response.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function formatProducts(records) {
  return records.map(record => {
    const fields = record.fields;
    return {
      name: fields["Product Name"] || "Unnamed product",
      images: fields["Product Images"] || [],
      category: fields["Category"] || "",
      subCategories: fields["Sub-Category"] || []
    };
  });
}

function populateCategoryFilter(products) {
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
}

function renderProducts() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filtered = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  resultCount.textContent = `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`;

  if (filtered.length === 0) {
    productGrid.innerHTML = '<p class="no-results">No products match your search.</p>';
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const imageUrl = product.images.length > 0 ? product.images[0].url : null;

    const imageHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<span class="no-image">📦</span>`;

    const subTagsHtml = product.subCategories
      .slice(0, 3)
      .map(tag => `<span class="sub-tag">${escapeHtml(tag)}</span>`)
      .join("");

    return `
      <div class="product-card">
        <div class="product-image">${imageHtml}</div>
        <div class="product-info">
          <p class="product-name">${escapeHtml(product.name)}</p>
          ${product.category ? `<span class="product-category">${escapeHtml(product.category)}</span>` : ""}
          <div class="product-subcategories">${subTagsHtml}</div>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);

async function init() {
  try {
    const records = await fetchAllProducts();
    allProducts = formatProducts(records);
    populateCategoryFilter(allProducts);
    loadingMsg.style.display = "none";
    renderProducts();
  } catch (error) {
    loadingMsg.textContent = "Couldn't load products. Please check back later.";
    console.error(error);
  }
}

init();
