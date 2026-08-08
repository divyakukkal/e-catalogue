// ---- Airtable connection settings ----
const AIRTABLE_TOKEN = "patjVWplT3Tx0xUqY.bd5a714543f88802eafc51667bc414bfc6ed17bedee6a080bddad6a7d7283925";
const BASE_ID = "appnvBGNd1VskROtg";
const PRODUCTS_TABLE = "Products";
const CATEGORIES_TABLE = "Categories";
const SUBCATEGORIES_TABLE = "Sub-Categories";

let allProducts = [];

const productGrid = document.getElementById("productGrid");
const loadingMsg = document.getElementById("loadingMsg");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const subCategoryFilter = document.getElementById("subCategoryFilter");
const headerSubtitle = document.getElementById("headerSubtitle");

async function fetchAllRecords(tableName) {
  let records = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable request failed for ${tableName}: ${response.status}`);
    }

    const data = await response.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

function buildIdToNameMap(records, nameField) {
  const map = {};
  records.forEach(record => {
    map[record.id] = record.fields[nameField] || "";
  });
  return map;
}

function formatProducts(records, categoryMap, subCategoryMap) {
  return records.map(record => {
    const fields = record.fields;

    const categoryIds = fields["Category"] || [];
    const subCategoryIds = fields["Sub-Category"] || [];

    const categoryName = categoryIds.length > 0 ? categoryMap[categoryIds[0]] : "";
    const subCategoryNames = subCategoryIds.map(id => subCategoryMap[id]).filter(Boolean);

    return {
      name: fields["Product Name"] || "Unnamed product",
      images: fields["Product Images"] || [],
      category: categoryName,
      subCategories: subCategoryNames
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

function populateSubCategoryFilter(products) {
  const allSubCats = products.flatMap(p => p.subCategories);
  const uniqueSubCats = [...new Set(allSubCats)].filter(Boolean).sort();
  uniqueSubCats.forEach(subCat => {
    const option = document.createElement("option");
    option.value = subCat;
    option.textContent = subCat;
    subCategoryFilter.appendChild(option);
  });
}

function renderProducts() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedSubCategory = subCategoryFilter.value;

  const filtered = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSubCategory = !selectedSubCategory || product.subCategories.includes(selectedSubCategory);
    return matchesSearch && matchesCategory && matchesSubCategory;
  });

  resultCount.textContent = `${filtered.length} product${filtered.length === 1 ? "" : "s"} found`;

  if (filtered.length === 0) {
    productGrid.innerHTML = '<p class="no-results">No products match your search.</p>';
    return;
  }

  productGrid.innerHTML = filtered.map((product, i) => {
    const imageUrl = product.images.length > 0 ? product.images[0].url : null;

    const imageHtml = imageUrl
      ? `<img src="${imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : `<span class="no-image">NO IMG</span>`;

    const subTagsHtml = product.subCategories
      .slice(0, 3)
      .map(tag => `<span class="sub-tag">${escapeHtml(tag)}</span>`)
      .join("");

    const indexLabel = "No. " + String(i + 1).padStart(3, "0");

    return `
      <div class="product-card">
        <span class="card-index">${indexLabel}</span>
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
subCategoryFilter.addEventListener("change", renderProducts);

async function init() {
  try {
    const [productRecords, categoryRecords, subCategoryRecords] = await Promise.all([
      fetchAllRecords(PRODUCTS_TABLE),
      fetchAllRecords(CATEGORIES_TABLE),
      fetchAllRecords(SUBCATEGORIES_TABLE)
    ]);

    const categoryMap = buildIdToNameMap(categoryRecords, "Category Name");
    const subCategoryMap = buildIdToNameMap(subCategoryRecords, "Sub-Category Name");

    allProducts = formatProducts(productRecords, categoryMap, subCategoryMap);
    populateCategoryFilter(allProducts);
    populateSubCategoryFilter(allProducts);

    headerSubtitle.textContent = `${allProducts.length} products, curated and cross-referenced`;

    loadingMsg.style.display = "none";
    renderProducts();
  } catch (error) {
    loadingMsg.textContent = "Couldn't load products. Please check back later.";
    headerSubtitle.textContent = "Catalogue temporarily unavailable";
    console.error(error);
  }
}

init();
