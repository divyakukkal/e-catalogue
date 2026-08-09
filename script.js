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

// Fetches ALL records from a given table, handling pagination.
// Returns an empty array (instead of throwing) if the table doesn't exist —
// this lets us safely "guess" a few possible table names without breaking things.
async function fetchAllRecordsSafe(tableName) {
  try {
    return await fetchAllRecords(tableName);
  } catch (error) {
    console.warn(`Table "${tableName}" not found or inaccessible, skipping.`);
    return [];
  }
}

async function fetchAllRecords(tableName) {
  let records = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (offset) {
      url += `&offset=${offset}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
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

// Builds a lookup map: record ID -> readable name, e.g. { "rec123": "CORRUGATED BOXES" }
// Skips writing a blank name if the field genuinely isn't present on that record.
function buildIdToNameMap(records, nameField) {
  const map = {};
  records.forEach(record => {
    const value = record.fields[nameField];
    if (value) {
      map[record.id] = value;
    }
  });
  return map;
}

// Resolves a raw Airtable field value into a clean array of readable strings,
// no matter whether it's linked record IDs, plain text, a single string, or missing.
function resolveToNames(rawValue, idToNameMap) {
  if (!rawValue) return [];

  const valuesArray = Array.isArray(rawValue) ? rawValue : [rawValue];

  return valuesArray
    .map(value => {
      if (idToNameMap && Object.prototype.hasOwnProperty.call(idToNameMap, value)) {
        return idToNameMap[value];
      }
      return value;
    })
    .filter(Boolean);
}

function getFieldValue(fields, possibleNames) {
  for (const name of possibleNames) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== "") {
      return fields[name];
    }
  }
  return null;
}

function formatProducts(records, categoryMap, subCategoryMap) {
  return records.map(record => {
    const fields = record.fields;

    const rawCategory = getFieldValue(fields, ["Category", "Categories"]);
    const rawSubCategory = getFieldValue(fields, ["Sub-Category", "Sub-Categories", "Subcategory", "Subcategories"]);

    const categoryNames = resolveToNames(rawCategory, categoryMap);
    const subCategoryNames = resolveToNames(rawSubCategory, subCategoryMap);

    return {
      name: fields["Product Name"] || "Unnamed product",
      images: fields["Product Images"] || [],
      category: categoryNames[0] || "",
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
    const [productRecords, categoryRecords] = await Promise.all([
      fetchAllRecords(PRODUCTS_TABLE),
      fetchAllRecords(CATEGORIES_TABLE)
    ]);

    // Try BOTH possible sub-category table names and merge whatever we find —
    // this protects us from a singular-vs-plural table naming mixup.
    // IMPORTANT: build each table's ID->name map SEPARATELY (they may use
    // different column names internally), then merge the maps — not the raw records.
    const [subCatPlural, subCatSingular] = await Promise.all([
      fetchAllRecordsSafe("Sub-Categories"),
      fetchAllRecordsSafe("Sub-Category")
    ]);

    const subCategoryMapPlural = buildIdToNameMap(
      subCatPlural,
      findPrimaryFieldName(subCatPlural, ["Sub-Category Name", "Name"])
    );
    const subCategoryMapSingular = buildIdToNameMap(
      subCatSingular,
      findPrimaryFieldName(subCatSingular, ["Sub-Category Name", "Name"])
    );
    const subCategoryMap = { ...subCategoryMapPlural, ...subCategoryMapSingular };

    // Try a few likely name-field variants for the Categories table too
    const categoryMap = buildIdToNameMap(categoryRecords, findPrimaryFieldName(categoryRecords, ["Category Name", "Name"]));

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

// Looks at the first record of a table and figures out which of the
// possible field names actually exists, so small naming differences don't break things
function findPrimaryFieldName(records, possibleNames) {
  if (records.length === 0) return possibleNames[0];
  const sampleFields = records[0].fields;
  for (const name of possibleNames) {
    if (Object.prototype.hasOwnProperty.call(sampleFields, name)) {
      return name;
    }
  }
  return possibleNames[0];
}

init();
 
  


