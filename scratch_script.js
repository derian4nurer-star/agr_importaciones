
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Outfit', 'sans-serif'],
            cyber: ['Rajdhani', 'sans-serif'],
          },
          colors: {
            agr: {
              red: '#C8232B',
              redhover: '#A81B22',
              redglow: '#DC2626',
              reddark: '#881337',
              bg: '#08090C',
              surface: '#131722',
              surfaceHover: '#1A1F2D',
              border: '#21262D',
              borderHover: '#C8232B'
            }
          },
          boxShadow: {
            'glow-red': '0 0 20px rgba(200, 35, 43, 0.4)',
            'glow-red-lg': '0 0 35px rgba(200, 35, 43, 0.6)',
            'cyber-card': '0 4px 25px -2px rgba(0, 0, 0, 0.85)'
          }
        }
      }
    }
  

    const STORAGE_KEY = 'agr_cyber_cart_v2';
    let productsList = [];
    let cart = [];
    let activeCategory = 'TODOS';
    let currentModalProduct = null;
    let selectedModalVariant = '';
    let selectedModalQty = 1;

    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
      loadCartFromStorage();
      fetchProductsInitial();

      // Polling cada 30 segundos
      setInterval(pollRealTimeProducts, 30000);
    });

    function loadCartFromStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) cart = JSON.parse(stored);
      } catch (e) {
        cart = [];
      }
      updateCartUI();
    }

    function saveCartToStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
      } catch (e) {}
    }

    async function fetchProductsInitial() {
      const endpoints = [
        './productos.json?t=' + Date.now(),
        '/productos.json?t=' + Date.now(),
        '/public/productos.json?t=' + Date.now()
      ];

      for (let url of endpoints) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              productsList = data;
              renderCategoryPills();
              renderPopularCarousel();
              renderCatalogGrid();
              validateCartStockWithRealtimeData();
              return;
            }
          }
        } catch (e) {}
      }

      try {
        const resApi = await fetch('/api/productos');
        if (resApi.ok) {
          const rawProds = await resApi.json();
          productsList = rawProds.map(p => ({
            sku: p.sku || '',
            nombre: p.descripcion || '',
            marca: p.marca || 'AGR',
            categoria: p.categoria || 'Otros',
            precio: typeof p.precio_venta === 'number' ? p.precio_venta : 0,
            stock_total: typeof p.stock_actual === 'number' ? p.stock_actual : 0,
            variantes: parseVariantOptions(p.variantes || ''),
            imagenes: p.imagen ? [`imagenes/${p.imagen}`] : [],
            descripcion: p.descripcion_detallada || p.descripcion || '',
            popular: Boolean(p.es_popular),
            stock_actual: p.stock_actual || 0,
            precio_venta: p.precio_venta || 0,
            variantes_raw: p.variantes || ''
          }));
          renderCategoryPills();
          renderPopularCarousel();
          renderCatalogGrid();
          validateCartStockWithRealtimeData();
        }
      } catch (err) {
        console.error('Error cargando inventario:', err);
        showToast('Error al conectar con el inventario.', 'error');
      }
    }

    async function pollRealTimeProducts() {
      try {
        const res = await fetch('./productos.json?t=' + Date.now());
        if (!res.ok) return;
        const freshData = await res.json();
        productsList = freshData;
        
        renderPopularCarousel();
        renderCatalogGrid();
        validateCartStockWithRealtimeData();
      } catch (e) {
        console.log('Background poll error:', e);
      }
    }

    function validateCartStockWithRealtimeData() {
      let cartChanged = false;
      cart.forEach(item => {
        const fresh = productsList.find(p => p.sku === item.sku);
        if (fresh) {
          item.stock_actual = fresh.stock_actual;
          if (item.cantidad > fresh.stock_actual) {
            if (fresh.stock_actual === 0) {
              showToast(`⚠️ El producto ${item.sku} se ha agotado en almacén.`, 'warning');
              item.cantidad = 0;
            } else {
              showToast(`⚠️ El producto ${item.sku} ajustó su stock a ${fresh.stock_actual} unids.`, 'warning');
              item.cantidad = fresh.stock_actual;
            }
            cartChanged = true;
          }
        }
      });

      cart = cart.filter(i => i.cantidad > 0);
      if (cartChanged) {
        saveCartToStorage();
        updateCartUI();
      }
    }

    function getImageUrl(img) {
      if (!img) return '';
      let str = String(img).trim();
      if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
        return str;
      }
      str = str.replace(/^\.\//, '');
      str = str.replace(/^public\//, '').replace(/^\/public\//, '');
      str = str.replace(/^\/?imagenes\//, '');
      return `/imagenes/${str}`;
    }

    function parseVariantOptions(variantesStr) {
      if (!variantesStr || !variantesStr.trim()) return ['Estándar'];
      const raw = variantesStr.trim();
      const options = [];
      const parts = raw.split(/,|\//);
      parts.forEach(part => {
        let cleaned = part.trim();
        if (cleaned.includes(':')) {
          cleaned = cleaned.split(':')[0].trim();
        }
        if (cleaned) options.push(cleaned);
      });
      return options.length > 0 ? options : [raw];
    }

    function extractVariantList(variantesData) {
      if (!variantesData) return ['Estándar'];
      if (Array.isArray(variantesData)) {
        if (variantesData.length === 0) return ['Estándar'];
        const list = variantesData.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.nombre || '';
          }
          let s = String(v).trim();
          if (s.includes(':')) s = s.split(':')[0].trim();
          return s;
        }).filter(Boolean);
        return list.length > 0 ? list : ['Estándar'];
      }
      return parseVariantOptions(String(variantesData));
    }

    // Control de visibilidad inteligente de botones del carrusel
    function updateCarouselArrowsVisibility() {
      const carousel = document.getElementById('popular-products-row');
      const leftBtn = document.getElementById('carousel-btn-left');
      const rightBtn = document.getElementById('carousel-btn-right');
      if (!carousel || !leftBtn || !rightBtn) return;

      const hasOverflow = carousel.scrollWidth > carousel.clientWidth + 10;
      if (!hasOverflow) {
        leftBtn.classList.add('hidden');
        rightBtn.classList.add('hidden');
      } else {
        leftBtn.classList.remove('hidden');
        rightBtn.classList.remove('hidden');

        const canScrollLeft = carousel.scrollLeft > 5;
        const canScrollRight = Math.ceil(carousel.scrollLeft + carousel.clientWidth) < carousel.scrollWidth - 5;

        leftBtn.style.opacity = canScrollLeft ? '1' : '0.2';
        leftBtn.style.pointerEvents = canScrollLeft ? 'auto' : 'none';

        rightBtn.style.opacity = canScrollRight ? '1' : '0.2';
        rightBtn.style.pointerEvents = canScrollRight ? 'auto' : 'none';
      }
    }

    // Scroll Suave del Carrusel de Populares
    function scrollPopularCarousel(direction) {
      const row = document.getElementById('popular-products-row');
      if (row) {
        row.scrollBy({ left: direction * 320, behavior: 'smooth' });
        setTimeout(updateCarouselArrowsVisibility, 350);
      }
    }

    // Habilitar Arrastre Táctil / Mouse Drag en el Carrusel
    function setupCarouselDrag() {
      const carousel = document.getElementById('popular-products-row');
      if (!carousel || carousel.dataset.dragSetup) return;
      carousel.dataset.dragSetup = "true";

      let isDown = false;
      let startX;
      let scrollLeft;

      carousel.addEventListener('mousedown', (e) => {
        isDown = true;
        carousel.classList.add('cursor-grabbing');
        startX = e.pageX - carousel.offsetLeft;
        scrollLeft = carousel.scrollLeft;
      });

      carousel.addEventListener('mouseleave', () => {
        isDown = false;
        carousel.classList.remove('cursor-grabbing');
      });

      carousel.addEventListener('mouseup', () => {
        isDown = false;
        carousel.classList.remove('cursor-grabbing');
      });

      carousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - carousel.offsetLeft;
        const walk = (x - startX) * 1.5;
        carousel.scrollLeft = scrollLeft - walk;
        updateCarouselArrowsVisibility();
      });

      window.addEventListener('resize', updateCarouselArrowsVisibility);
    }

    // Renderizar Productos Populares (Filtro por es_popular = true o Top 8)
    let isDescriptionExpanded = false;

    function toggleModalDescription() {
      const textEl = document.getElementById('modal-description-text');
      const toggleBtn = document.getElementById('modal-description-toggle');
      if (!textEl || !toggleBtn) return;

      isDescriptionExpanded = !isDescriptionExpanded;

      if (isDescriptionExpanded) {
        textEl.style.display = 'block';
        textEl.style.webkitLineClamp = 'unset';
        textEl.style.webkitBoxOrient = 'unset';
        textEl.style.overflow = 'visible';
        textEl.style.maskImage = 'none';
        textEl.style.webkitMaskImage = 'none';
        toggleBtn.textContent = 'ver menos';
      } else {
        textEl.style.display = '-webkit-box';
        textEl.style.webkitLineClamp = '3';
        textEl.style.webkitBoxOrient = 'vertical';
        textEl.style.overflow = 'hidden';
        textEl.style.maskImage = 'linear-gradient(to bottom, black 60%, transparent 100%)';
        textEl.style.webkitMaskImage = 'linear-gradient(to bottom, black 60%, transparent 100%)';
        toggleBtn.textContent = '...ver más';
      }
    }

    function formatMoney(amount) {
      const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
      if (isNaN(num)) return '0.00';
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderPopularCarousel() {
      const container = document.getElementById('popular-products-inner') || document.getElementById('popular-products-row');
      if (!container) return;

      let popularList = productsList.filter(p => p.es_popular === true);
      if (popularList.length === 0) popularList = productsList.slice(0, 8);

      container.innerHTML = popularList.map(p => {
        const imagePath = getImageUrl(p.imagen || (Array.isArray(p.imagenes) ? p.imagenes[0] : ''));
        const isOutOfStock = p.stock_actual === 0;
        const defaultVariant = (Array.isArray(p.variantes) ? p.variantes[0] : parseVariantOptions(p.variantes_raw || p.variantes)[0]) || 'Estándar';
        const itemPrice = typeof p.precio === 'number' ? p.precio : (p.precio_venta || 0);

        return `
          <div class="bg-[#12151c] border border-neutral-800/80 hover:border-[#C8232B]/60 rounded-2xl p-3 min-w-[210px] max-w-[210px] shadow-md shadow-black/50 hover:-translate-y-1.5 hover:shadow-[0_10px_25px_-5px_rgba(200,35,43,0.25)] flex flex-col justify-between flex-shrink-0 group transition-all duration-300 ${isOutOfStock ? 'opacity-50 grayscale-[40%]' : ''}">
            
            <div onclick="openProductModal('${p.sku}')" class="cursor-pointer">
              <div class="h-32 bg-[#08090C] rounded-xl overflow-hidden relative flex items-center justify-center mb-2.5 border border-neutral-800">
                ${imagePath ? `
                  <img src="${imagePath}" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-[10px] font-cyber font-bold text-neutral-500\\'>AGR IMPORT</span>';"
                    class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                ` : `
                  <span class="text-[10px] font-cyber font-bold text-neutral-500">AGR IMPORT</span>
                `}
                
                ${isOutOfStock ? `
                  <span class="absolute top-1.5 left-1.5 bg-[#08090C] text-neutral-400 font-bold text-[9px] px-2 py-0.5 rounded border border-neutral-700">
                    ❌ AGOTADO
                  </span>
                ` : `
                  <span class="absolute top-1.5 left-1.5 bg-[#C8232B] text-white font-cyber font-bold text-[9px] px-2 py-0.5 rounded shadow-md">
                    🔥 POPULAR
                  </span>
                `}
              </div>

              <div class="space-y-1">
                <span class="text-[9px] font-mono text-neutral-400 font-bold block">${p.sku}</span>
                <h4 class="font-bold text-[11px] line-clamp-1 text-white leading-tight hover:text-[#C8232B] transition">${p.nombre || p.descripcion}</h4>
                <span class="font-display font-black text-[#C8232B] text-sm block">S/ ${formatMoney(itemPrice)}</span>
              </div>
            </div>

            <!-- Botón directo de agregar -->
            <button onclick="addToCart('${p.sku}', 1, '${defaultVariant}')" type="button" ${isOutOfStock ? 'disabled' : ''}
              class="w-full mt-2.5 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 ${
                isOutOfStock 
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none' 
                  : 'bg-[#C8232B] hover:bg-[#A81B22] text-white shadow-md active:scale-95'
              }">
              <i data-lucide="${isOutOfStock ? 'x-circle' : 'plus'}" class="w-3.5 h-3.5"></i>
              <span>${isOutOfStock ? 'Agotado' : '+ Agregar'}</span>
            </button>
          </div>
        `;
      }).join('');

      lucide.createIcons();
      setupCarouselDrag();
      setTimeout(updateCarouselArrowsVisibility, 100);
    }

    // Renderizar Píldoras de Categoría
    function renderCategoryPills() {
      const categories = ['TODOS', ...new Set(productsList.map(p => (p.categoria || 'OTROS').toUpperCase()))];
      const container = document.getElementById('category-pills-container');

      container.innerHTML = categories.map(cat => {
        const isActive = cat === activeCategory;
        return `
          <button onclick="setCategoryFilter('${cat}')" type="button"
            class="rounded-full border px-4 py-2 text-xs font-bold font-cyber tracking-wider transition whitespace-nowrap ${
              isActive 
                ? 'bg-[#C8232B] text-white border-[#C8232B] shadow-glow-red' 
                : 'bg-[#161922] text-neutral-300 border-neutral-800 hover:border-[#C8232B] hover:text-white'
            }">
            ${cat === 'TODOS' ? 'TODOS LOS PRODUCTOS' : cat}
          </button>
        `;
      }).join('');
    }

    function setCategoryFilter(cat) {
      activeCategory = cat;
      const input = document.getElementById('catalog-search-input');
      if (input) input.value = '';
      renderCategoryPills();
      renderCatalogGrid();
    }

    function handleSearchInput() {
      const search = document.getElementById('catalog-search-input')?.value.trim() || '';
      if (search !== '' && activeCategory !== 'TODOS') {
        activeCategory = 'TODOS';
        renderCategoryPills();
      }
      renderCatalogGrid();
    }

    // Renderizar Cuadrícula del Catálogo (REGLA ESTRICTA DE STOCK ROJA + COMPRA DIRECTA)
    function renderCatalogGrid() {
      const search = document.getElementById('catalog-search-input')?.value.trim().toLowerCase() || '';
      const grid = document.getElementById('products-grid');
      const badge = document.getElementById('catalog-count-badge');

      const filtered = productsList.filter(p => {
        const cat = (p.categoria || '').toUpperCase();
        const matchesCat = search !== '' || activeCategory === 'TODOS' || cat === activeCategory;
        const skuStr = (p.sku || '').toLowerCase();
        const nameStr = (p.nombre || p.descripcion || '').toLowerCase();
        const brandStr = (p.marca || '').toLowerCase();
        const matchesSearch = !search ||
                               skuStr.includes(search) ||
                               nameStr.includes(search) ||
                               brandStr.includes(search);
        return matchesCat && matchesSearch;
      });

      if (badge) badge.textContent = `${filtered.length} productos`;

      if (filtered.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-20 bg-[#131722] border border-neutral-800/80 rounded-3xl p-8 text-neutral-400 space-y-3">
            <i data-lucide="search-x" class="w-10 h-10 text-neutral-600 mx-auto"></i>
            <p class="font-bold text-sm">No se encontraron productos disponibles en el catálogo.</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      grid.innerHTML = filtered.map(p => {
        const imagePath = getImageUrl(p.imagen || (Array.isArray(p.imagenes) ? p.imagenes[0] : ''));
        const stock = typeof p.stock === 'number' ? p.stock : (p.stock_actual || 0);

        let stockLabelText = '';
        let stockLabelClass = '';
        let badgeHTML = '';
        let stockPercent = 100;
        let isOutOfStock = false;

        if (stock >= 21) {
          stockLabelText = 'Hay stock';
          stockLabelClass = 'text-neutral-300 font-bold';
          badgeHTML = `<span class="bg-[#C8232B]/20 text-red-300 border border-[#C8232B]/40 text-[10px] font-bold px-2.5 py-0.5 rounded-full">✔ Hay stock</span>`;
          stockPercent = 100;
        } else if (stock >= 1 && stock <= 20) {
          stockLabelText = `${stock} unids`;
          stockLabelClass = 'text-[#C8232B] font-bold';
          badgeHTML = `<span class="bg-[#C8232B]/30 text-red-300 border border-[#C8232B]/60 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full animate-pulse">⚡ ¡Solo quedan ${stock} unids!</span>`;
          stockPercent = Math.min(100, Math.max(8, (stock / 20) * 100));
        } else {
          stockLabelText = 'Agotado';
          stockLabelClass = 'text-neutral-500 font-bold';
          badgeHTML = `<span class="bg-[#08090C] text-neutral-400 border border-neutral-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">❌ AGOTADO</span>`;
          stockPercent = 0;
          isOutOfStock = true;
        }

        const variants = Array.isArray(p.variantes) ? p.variantes : parseVariantOptions(p.variantes_raw || p.variantes);
        const defaultVariant = variants[0] || 'Estándar';
        const itemPrice = typeof p.precio === 'number' ? p.precio : (p.precio_venta || 0);

        return `
          <div class="bg-[#12151c] border border-neutral-800/80 hover:border-[#C8232B]/60 rounded-3xl overflow-hidden shadow-md shadow-black/50 hover:-translate-y-1.5 hover:shadow-[0_10px_25px_-5px_rgba(200,35,43,0.25)] transition-all duration-300 flex flex-col justify-between group ${isOutOfStock ? 'opacity-60 grayscale-[40%]' : ''}">
            
            <!-- Clic en foto o título abre el modal de detalle -->
            <div onclick="openProductModal('${p.sku}')" class="cursor-pointer">
              
              <!-- Imagen del Producto -->
              <div class="aspect-square bg-[#08090C] relative overflow-hidden flex items-center justify-center border-b border-neutral-800">
                ${imagePath ? `
                  <img src="${imagePath}" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'text-xs font-cyber font-bold text-neutral-500\\'>AGR IMPORT</span>';"
                    class="w-full h-full object-cover group-hover:scale-105 transition duration-500" alt="${p.nombre || p.descripcion}">
                ` : `
                  <span class="text-xs font-cyber font-bold text-neutral-500">AGR IMPORTACIONES</span>
                `}

                <!-- Badge SKU Superior -->
                <span class="absolute top-3 left-3 bg-[#08090C]/90 text-white text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border border-neutral-700 shadow-md">
                  COD: ${p.sku}
                </span>

                <!-- Badge Stock Floating -->
                <div class="absolute bottom-3 left-3 right-3 text-center">
                  ${badgeHTML}
                </div>
              </div>

              <!-- Detalles del Producto -->
              <div class="p-4 space-y-2">
                <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span class="text-[#C8232B]">COD: ${p.sku}</span>
                  <span class="bg-[#08090C] px-2 py-0.5 rounded text-neutral-300 border border-neutral-800 text-[10px]">${p.categoria}</span>
                </div>

                <h3 class="font-bold text-white text-sm leading-snug line-clamp-2 hover:text-[#C8232B] transition">${p.nombre || p.descripcion}</h3>

                <!-- Barra de Disponibilidad ROJA PROPORCIONAL -->
                <div class="space-y-1 pt-1">
                  <div class="flex justify-between text-[10px] text-neutral-400 font-semibold">
                    <span>Disponibilidad en almacén</span>
                    <span class="${stockLabelClass}">${stockLabelText}</span>
                  </div>
                  <div class="w-full bg-[#08090C] h-1.5 rounded-full overflow-hidden border border-neutral-800">
                    <div class="bg-[#C8232B] h-full rounded-full transition-all duration-500" style="width: ${stockPercent}%"></div>
                  </div>
                </div>

                <!-- Precio Mayorista -->
                <div class="pt-2">
                  <span class="text-[9px] font-cyber text-neutral-400 block uppercase">PRECIO MAYORISTA</span>
                  <span class="font-display font-black text-[#C8232B] text-2xl tracking-tight">S/ ${formatMoney(itemPrice)}</span>
                </div>
              </div>

            </div>

            <!-- BOTÓN PRINCIPAL ROJO EN LA TARJETA (AGREGA DIRECTO SIN ABRIR MODAL) -->
            <div class="p-4 pt-0">
              <button onclick="addToCart('${p.sku}', 1, '${defaultVariant}')" type="button" ${isOutOfStock ? 'disabled' : ''}
                class="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 ${
                  isOutOfStock
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed shadow-none'
                    : 'bg-[#C8232B] hover:bg-[#A81B22] text-white shadow-md shadow-red-950/40 active:scale-95'
                }">
                <i data-lucide="${isOutOfStock ? 'x-circle' : 'shopping-cart'}" class="w-4 h-4"></i>
                <span>${isOutOfStock ? 'Agotado' : '+ Agregar al carrito'}</span>
              </button>
            </div>

          </div>
        `;
      }).join('');

      lucide.createIcons();
    }

    // ABRIR MODAL DETALLADO DE PRODUCTO (GALERÍA MULTI-IMAGEN & DESCRIPCIÓN DETALLADA)
    function openProductModal(sku) {
      const p = productsList.find(i => i.sku === sku);
      if (!p) return;

      currentModalProduct = p;
      selectedModalQty = 1;
      
      const itemPrice = typeof p.precio === 'number' ? p.precio : (p.precio_venta || 0);

      // Galería de Imágenes (Soporta arreglo imagenes o imagen individual)
      let rawImgs = [];
      if (Array.isArray(p.imagenes) && p.imagenes.length > 0) {
        rawImgs = p.imagenes;
      } else if (p.imagen) {
        rawImgs = [p.imagen];
      }

      const thumbImages = rawImgs.map(img => getImageUrl(img));
      const mainImageSrc = thumbImages[0] || '';

      document.getElementById('modal-main-image').src = mainImageSrc;
      document.getElementById('modal-sku-badge').textContent = `COD: ${p.sku}`;
      document.getElementById('modal-brand-text').textContent = p.marca;
      document.getElementById('modal-category-text').textContent = p.categoria;
      document.getElementById('modal-title-text').textContent = p.nombre || p.descripcion;
      document.getElementById('modal-price-text').textContent = `S/ ${formatMoney(itemPrice)}`;
      document.getElementById('modal-qty-display').textContent = '1';

      // Limpieza y manejo condicional estricto de la descripción colapsable
      const descVal = (p.descripcion_detallada || p.descripcion_larga || p.descripcion || '').trim();
      const descContainer = document.getElementById('modal-description-container');
      const descTextEl = document.getElementById('modal-description-text');
      const descToggleBtn = document.getElementById('modal-description-toggle');

      if (descVal) {
        descTextEl.textContent = descVal;
        descContainer.classList.remove('hidden');
        
        isDescriptionExpanded = false;
        const isLongText = descVal.length > 120 || descVal.split('\n').length > 3;

        if (isLongText) {
          descTextEl.style.display = '-webkit-box';
          descTextEl.style.webkitLineClamp = '3';
          descTextEl.style.webkitBoxOrient = 'vertical';
          descTextEl.style.overflow = 'hidden';
          descTextEl.style.maskImage = 'linear-gradient(to bottom, black 60%, transparent 100%)';
          descTextEl.style.webkitMaskImage = 'linear-gradient(to bottom, black 60%, transparent 100%)';
          if (descToggleBtn) {
            descToggleBtn.textContent = '...ver más';
            descToggleBtn.classList.remove('hidden');
          }
        } else {
          descTextEl.style.display = 'block';
          descTextEl.style.webkitLineClamp = 'unset';
          descTextEl.style.webkitBoxOrient = 'unset';
          descTextEl.style.overflow = 'visible';
          descTextEl.style.maskImage = 'none';
          descTextEl.style.webkitMaskImage = 'none';
          if (descToggleBtn) {
            descToggleBtn.classList.add('hidden');
          }
        }
      } else {
        descTextEl.textContent = '';
        descContainer.classList.add('hidden');
      }

      // Configurar Stock en Modal y Variantes Chips con Verificación de Stock por Variante
      currentModalProductVariants = getNormalizedVariants(p);

      let defaultVar = currentModalProductVariants.find(v => v.stock > 0);
      if (!defaultVar && currentModalProductVariants.length > 0) {
        defaultVar = currentModalProductVariants[0];
      }

      selectedModalVariant = defaultVar ? defaultVar.nombre : 'Estándar';
      selectedModalVariantObj = defaultVar;
      selectedModalQty = 1;
      document.getElementById('modal-qty-display').textContent = '1';

      updateModalStockDisplay(defaultVar, p);

      const chipsContainer = document.getElementById('modal-variant-chips-container');
      if (chipsContainer) {
        chipsContainer.innerHTML = currentModalProductVariants.map((v) => {
          const isAvailable = v.stock > 0;
          const isSelected = defaultVar && defaultVar.nombre === v.nombre && isAvailable;

          if (isAvailable) {
            return `
              <button type="button" onclick="selectModalVariant('${v.nombre}', this)"
                class="variant-chip px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  isSelected 
                    ? 'active bg-[#C8232B] text-white border-[#C8232B] shadow-lg shadow-red-900/30' 
                    : 'bg-[#08090C] text-neutral-300 border-neutral-800 hover:border-[#C8232B]'
                }">
                ${v.nombre}
              </button>
            `;
          } else {
            return `
              <button type="button" disabled
                class="variant-chip px-3.5 py-1.5 rounded-xl border text-xs font-bold opacity-40 line-through bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed"
                title="Variante agotada">
                ${v.nombre} <span class="text-[10px] no-underline font-normal ml-0.5">(Agotado)</span>
              </button>
            `;
          }
        }).join('');
      }

      // Configurar Miniaturas Intercambiables (Soporta de 1 a 4 Fotos)
      const thumbsContainer = document.getElementById('modal-thumbnails-row');
      if (thumbImages.length <= 1) {
        thumbsContainer.innerHTML = '';
      } else {
        thumbsContainer.innerHTML = thumbImages.map((img, idx) => `
          <button type="button" onclick="changeModalMainImage('${img}', this)"
            class="modal-thumb-btn w-14 h-14 bg-[#08090C] rounded-xl overflow-hidden border ${idx === 0 ? 'border-[#C8232B] ring-2 ring-[#C8232B]/30 opacity-100' : 'border-neutral-800 opacity-60'} flex-shrink-0 hover:border-[#C8232B] hover:opacity-100 transition duration-200 cursor-pointer">
            <img src="${img}" class="w-full h-full object-cover">
          </button>
        `).join('');
      }

      // Cargar Productos Relacionados
      renderModalRelatedProducts(p.categoria, p.sku);

      document.getElementById('product-detail-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function closeProductModal() {
      document.getElementById('product-detail-modal').classList.add('hidden');
    }

    function selectModalVariant(variantName, buttonEl) {
      const found = currentModalProductVariants.find(v => v.nombre === variantName);
      if (!found || found.stock <= 0) {
        showToast(`La variante ${variantName} está agotada.`, 'warning');
        return;
      }

      selectedModalVariant = found.nombre;
      selectedModalVariantObj = found;
      selectedModalQty = 1;
      document.getElementById('modal-qty-display').textContent = '1';

      const allChips = document.querySelectorAll('.variant-chip');
      allChips.forEach(chip => {
        if (!chip.disabled) {
          chip.className = 'variant-chip px-3.5 py-1.5 rounded-xl border text-xs font-bold transition bg-[#08090C] text-neutral-300 border-neutral-800 hover:border-[#C8232B]';
        }
      });

      if (buttonEl) {
        buttonEl.className = 'variant-chip px-3.5 py-1.5 rounded-xl border text-xs font-bold transition active bg-[#C8232B] text-white border-[#C8232B] shadow-lg shadow-red-900/30';
      }

      if (currentModalProduct) {
        updateModalStockDisplay(found, currentModalProduct);
      }
    }

    function changeModalMainImage(imgSrc, btnEl) {
      if (imgSrc) {
        document.getElementById('modal-main-image').src = imgSrc;
      }
      if (btnEl) {
        const allThumbs = document.querySelectorAll('.modal-thumb-btn');
        allThumbs.forEach(btn => {
          btn.className = 'modal-thumb-btn w-14 h-14 bg-[#08090C] rounded-xl overflow-hidden border border-neutral-800 opacity-60 flex-shrink-0 hover:border-[#C8232B] hover:opacity-100 transition duration-200 cursor-pointer';
        });
        btnEl.className = 'modal-thumb-btn w-14 h-14 bg-[#08090C] rounded-xl overflow-hidden border border-[#C8232B] ring-2 ring-[#C8232B]/30 opacity-100 flex-shrink-0 transition duration-200 cursor-pointer';
      }
    }

    function updateModalQty(change) {
      if (!currentModalProduct) return;
      let maxStock = selectedModalVariantObj ? selectedModalVariantObj.stock : currentModalProduct.stock_actual;
      if (maxStock <= 0) maxStock = 1;

      let newQty = selectedModalQty + change;
      if (newQty < 1) newQty = 1;
      if (newQty > maxStock) {
        newQty = maxStock;
        showToast(`Stock máximo disponible para ${selectedModalVariant || 'esta variante'}: ${maxStock} unids`, 'warning');
      }
      selectedModalQty = newQty;
      document.getElementById('modal-qty-display').textContent = selectedModalQty;
    }

    function renderModalRelatedProducts(category, currentSku) {
      const container = document.getElementById('modal-related-products-row');
      if (!container) return;

      const related = productsList.filter(p => p.categoria === category && p.sku !== currentSku).slice(0, 6);
      if (related.length === 0) {
        container.innerHTML = `<span class="text-xs text-neutral-500 italic">No hay otros productos en esta categoría.</span>`;
        return;
      }

      container.innerHTML = related.map(p => {
        const imagePath = p.imagen ? (p.imagen.startsWith('http') ? p.imagen : `./imagenes/${p.imagen}`) : '';
        return `
          <div onclick="openProductModal('${p.sku}')"
            class="bg-[#08090C] border border-neutral-800 hover:border-[#C8232B] rounded-xl p-2.5 min-w-[150px] max-w-[150px] flex-shrink-0 cursor-pointer group transition">
            <div class="h-24 bg-[#131722] rounded-lg overflow-hidden mb-2 flex items-center justify-center">
              ${imagePath ? `<img src="${imagePath}" class="w-full h-full object-cover">` : `<span class="text-[9px] font-cyber text-neutral-500">AGR</span>`}
            </div>
            <span class="text-[9px] font-mono text-neutral-400 font-bold block">${p.sku}</span>
            <h5 class="font-bold text-[10px] line-clamp-1 text-white hover:text-[#C8232B] transition">${p.descripcion}</h5>
            <span class="font-display font-bold text-[#C8232B] text-xs">S/ ${formatMoney(p.precio_venta)}</span>
          </div>
        `;
      }).join('');
    }

    // AGREGAR AL CARRITO (DIRECTO O DESDE MODAL)
    function getNormalizedVariants(p) {
      if (!p) return [{ nombre: 'Estándar', stock: 0 }];

      if (Array.isArray(p.variantes) && p.variantes.length > 0) {
        return p.variantes.map(v => {
          if (typeof v === 'object' && v !== null) {
            return {
              nombre: String(v.nombre || 'Estándar').trim(),
              stock: typeof v.stock === 'number' ? Math.max(0, v.stock) : 0
            };
          }
          let nameStr = String(v).trim();
          let st = 0;
          if (nameStr.includes(':')) {
            const parts = nameStr.split(':');
            nameStr = parts[0].trim();
            st = parseInt(parts[1].trim()) || 0;
          }
          return { nombre: nameStr, stock: Math.max(0, st) };
        });
      }

      const rawStr = p.variantes_raw || p.lista_variantes || (typeof p.variantes === 'string' ? p.variantes : '');
      if (!rawStr || !rawStr.trim()) {
        const totalSt = typeof p.stock_total === 'number' ? p.stock_total : (typeof p.stock === 'number' ? p.stock : (p.stock_actual || 0));
        return [{ nombre: 'Estándar', stock: Math.max(0, totalSt) }];
      }

      const parts = rawStr.split(',').map(s => s.trim()).filter(Boolean);
      const list = [];
      parts.forEach(part => {
        if (part.includes(':')) {
          const idx = part.indexOf(':');
          const name = part.substring(0, idx).trim();
          const st = parseInt(part.substring(idx + 1).trim()) || 0;
          if (name) list.push({ nombre: name, stock: Math.max(0, st) });
        } else {
          if (part) list.push({ nombre: part, stock: 0 });
        }
      });

      return list.length > 0 ? list : [{ nombre: 'Estándar', stock: 0 }];
    }

    function getProductTotalStock(product) {
      if (!product) return 0;
      const normVariants = getNormalizedVariants(product);
      if (normVariants && normVariants.length > 0) {
        const sumVariants = normVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        if (sumVariants > 0) {
          return sumVariants;
        }
      }
      if (typeof product.stock_total === 'number') return product.stock_total;
      if (typeof product.stock_actual === 'number') return product.stock_actual;
      if (typeof product.stock === 'number') return product.stock;
      return 0;
    }

    function updateModalStockDisplay(variantObj, product) {
      const totalStock = getProductTotalStock(product);
      const variantStock = variantObj ? variantObj.stock : totalStock;
      const variantName = variantObj ? variantObj.nombre : '';
      const stockLabel = document.getElementById('modal-stock-label');
      const stockBar = document.getElementById('modal-stock-bar');
      const addBtn = document.getElementById('modal-add-cart-btn');
      const buyBtn = document.getElementById('modal-buy-now-btn');

      if (!stockLabel || !stockBar) return;

      if (variantStock <= 0) {
        const vText = (variantName && variantName !== 'Estándar' && variantName !== 'Único') ? ` en ${variantName}` : '';
        if (totalStock > 0) {
          stockLabel.textContent = `Agotado${vText} (¡Quedan ${totalStock} unids en total!)`;
        } else {
          stockLabel.textContent = `Agotado temporalmente${vText}`;
        }
        stockLabel.className = 'font-bold text-neutral-500';
        stockBar.className = 'h-full bg-neutral-800 rounded-full transition-all duration-500';
        stockBar.style.width = '0%';
      } else if (totalStock >= 21) {
        const vDetail = (variantName && variantName !== 'Estándar' && variantName !== 'Único') ? ` (${variantName}: ${variantStock} unids)` : '';
        stockLabel.textContent = `Hay stock en almacén (${totalStock} unids)${vDetail}`;
        stockLabel.className = 'font-bold text-red-300';
        stockBar.className = 'h-full bg-[#C8232B] rounded-full transition-all duration-500';
        stockBar.style.width = '100%';
      } else {
        const vDetail = (variantName && variantName !== 'Estándar' && variantName !== 'Único') ? ` (${variantName}: ${variantStock} unids)` : '';
        stockLabel.textContent = `¡Solo quedan ${totalStock} unids!${vDetail}`;
        stockLabel.className = 'font-bold text-[#C8232B] animate-pulse';
        stockBar.className = 'h-full bg-[#C8232B] rounded-full transition-all duration-500';
        stockBar.style.width = `${Math.min(100, Math.max(8, (totalStock / 20) * 100))}%`;
      }

      if (addBtn) {
        if (variantStock === 0) {
          addBtn.disabled = true;
          addBtn.className = 'w-full py-3.5 bg-neutral-800 text-neutral-500 font-bold rounded-xl text-lg cursor-not-allowed flex items-center justify-center gap-2 shadow-none';
        } else {
          addBtn.disabled = false;
          addBtn.className = 'w-full py-3.5 bg-[#C8232B] hover:bg-[#A81B22] text-white font-bold rounded-xl text-lg transition-all active:scale-98 shadow-lg shadow-red-950/40 flex items-center justify-center gap-2 group';
        }
      }
    }

    function getBestAvailableVariant(p) {
      const norm = getNormalizedVariants(p);
      const inStock = norm.find(v => v.stock > 0);
      if (inStock) return inStock.nombre;
      return norm[0] ? norm[0].nombre : 'Único';
    }

    function addToCartFromModal() {
      if (!currentModalProduct) return;
      addToCart(currentModalProduct.sku, selectedModalQty, selectedModalVariant);
      closeProductModal();
    }

    function buyNowFromModal() {
      if (!currentModalProduct) return;

      const p = currentModalProduct;
      const variantText = selectedModalVariant || getBestAvailableVariant(p);
      const qty = selectedModalQty;
      const itemPrice = typeof p.precio === 'number' ? p.precio : (p.precio_venta || 0);
      const subtotal = itemPrice * qty;

      let msg = `🛒 *PEDIDO MAYORISTA - AGR IMPORTACIONES*\n`;
      msg += `Cliente: Cliente Web\n\n`;
      msg += `▪ ${p.nombre || p.descripcion} (Variante: ${variantText})\n`;
      msg += `  Cant: ${qty} x S/.${formatMoney(itemPrice)} = S/.${formatMoney(subtotal)}\n\n`;
      msg += `*TOTAL A PAGAR: S/.${formatMoney(subtotal)}*\n`;
      msg += `Hola AGR Importaciones, confirmo este pedido para coordinar el pago y el despacho de la mercadería.\n\n`;
      msg += `CODIGO_PEDIDO:[${p.sku}:${qty}]`;

      const targetURL = `https://wa.me/51992410709?text=${encodeURIComponent(msg)}`;
      window.open(targetURL, '_blank');
      closeProductModal();
    }

    function addToCart(sku, qty = 1, variantInput = null) {
      const p = productsList.find(i => i.sku === sku);
      if (!p) return;

      const normVariants = getNormalizedVariants(p);
      let variantObj = null;

      if (typeof variantInput === 'string' && variantInput.trim()) {
        variantObj = normVariants.find(v => v.nombre === variantInput.trim());
      } else if (variantInput && typeof variantInput === 'object' && variantInput.nombre) {
        variantObj = normVariants.find(v => v.nombre === String(variantInput.nombre).trim());
      }

      if (!variantObj) {
        variantObj = normVariants.find(v => v.stock > 0) || normVariants[0];
      }

      const variantName = variantObj ? variantObj.nombre : 'Único';
      const variantMaxStock = variantObj ? variantObj.stock : (typeof p.stock_total === 'number' ? p.stock_total : (p.stock_actual || 0));

      if (variantMaxStock <= 0) {
        showToast(`La variante ${variantName} de ${p.sku} está AGOTADA.`, 'warning');
        return;
      }

      const cartId = `${sku}_${variantName}`;
      const existing = cart.find(i => i.cartId === cartId);
      const currentQty = existing ? existing.cantidad : 0;

      if (currentQty + qty > variantMaxStock) {
        showToast(`Stock máximo disponible para ${variantName}: ${variantMaxStock} unids`, 'warning');
        return;
      }

      const itemPrice = typeof p.precio === 'number' ? p.precio : (p.precio_venta || 0);

      if (existing) {
        existing.cantidad += qty;
      } else {
        cart.push({
          cartId: cartId,
          sku: p.sku,
          descripcion: p.nombre || p.descripcion,
          precio_venta: itemPrice,
          stock_actual: variantMaxStock,
          cantidad: qty,
          variante_seleccionada: variantName,
          variante: variantName,
          selected: true,
          imagen: p.imagen || (Array.isArray(p.imagenes) ? p.imagenes[0] : '')
        });
      }

      saveCartToStorage();
      updateCartUI();
      animateCartButtons();
    }

    function animateCartButtons() {
      const headerBtn = document.getElementById('header-cart-btn');
      const floatBtn = document.getElementById('floating-cart-btn');
      [headerBtn, floatBtn].forEach(btn => {
        if (btn) {
          btn.classList.add('scale-105', 'ring-2', 'ring-[#C8232B]');
          setTimeout(() => btn.classList.remove('scale-105', 'ring-2', 'ring-[#C8232B]'), 300);
        }
      });
    }

    function updateCartItemQty(cartId, change) {
      const item = cart.find(i => i.cartId === cartId);
      if (!item) return;

      let newQty = item.cantidad + change;
      if (newQty <= 0) {
        removeFromCart(cartId);
        return;
      }

      if (newQty > item.stock_actual) {
        showToast(`Stock disponible alcanzado (${item.stock_actual})`, 'warning');
        item.cantidad = item.stock_actual;
      } else {
        item.cantidad = newQty;
      }

      saveCartToStorage();
      updateCartUI();
    }

    function toggleItemSelect(cartId, isChecked) {
      const item = cart.find(i => i.cartId === cartId);
      if (item) {
        item.selected = isChecked;
        saveCartToStorage();
        updateCartUI();
      }
    }

    function toggleSelectAllCart(isChecked) {
      cart.forEach(i => i.selected = isChecked);
      saveCartToStorage();
      updateCartUI();
    }

    function removeFromCart(cartId) {
      cart = cart.filter(i => i.cartId !== cartId);
      saveCartToStorage();
      updateCartUI();
    }

    function clearSelectedItems() {
      cart = cart.filter(i => i.selected === false);
      saveCartToStorage();
      updateCartUI();
    }

    function updateCartUI() {
      const headerBadge = document.getElementById('header-cart-badge');
      const headerTotal = document.getElementById('header-cart-total');
      const floatBadge = document.getElementById('floating-cart-badge');
      const floatTotal = document.getElementById('floating-cart-total');
      const drawerCount = document.getElementById('cart-drawer-count-badge');
      const selectedCount = document.getElementById('cart-selected-count');
      const drawerTotal = document.getElementById('cart-drawer-total-amount');
      const drawerList = document.getElementById('cart-drawer-items-list');

      let selectedItems = cart.filter(i => i.selected !== false);
      let totalAmount = 0;
      selectedItems.forEach(i => totalAmount += (i.precio_venta * i.cantidad));

      const totalItemsCount = cart.reduce((sum, item) => sum + item.cantidad, 0);

      if (headerBadge) headerBadge.textContent = totalItemsCount;
      if (headerTotal) headerTotal.textContent = `S/ ${formatMoney(totalAmount)}`;
      if (floatBadge) floatBadge.textContent = totalItemsCount;
      if (floatTotal) floatTotal.textContent = `S/ ${formatMoney(totalAmount)}`;
      if (drawerCount) drawerCount.textContent = `${cart.length} productos guardados`;
      if (selectedCount) selectedCount.textContent = selectedItems.length;
      if (drawerTotal) drawerTotal.textContent = `S/ ${formatMoney(totalAmount)}`;

      if (drawerList) {
        if (cart.length === 0) {
          drawerList.innerHTML = `
            <div class="text-center py-16 text-neutral-500 italic space-y-2">
              <i data-lucide="shopping-bag" class="w-10 h-10 text-neutral-600 mx-auto"></i>
              <p>Tu cesta está vacía.</p>
            </div>
          `;
        } else {
          drawerList.innerHTML = cart.map(i => {
            const isChecked = i.selected !== false;
            const itemTotal = formatMoney(i.precio_venta * i.cantidad);
            const imagePath = i.imagen ? (i.imagen.startsWith('http') ? i.imagen : `./imagenes/${i.imagen}`) : '';
            const variantDisplay = i.variante_seleccionada || i.variante || 'Único';

            return `
              <div class="bg-[#08090C] border border-neutral-800 rounded-2xl p-3.5 flex items-start gap-3 justify-between">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleItemSelect('${i.cartId}', this.checked)" class="w-4 h-4 accent-[#C8232B] rounded mt-1">

                <div class="w-14 h-14 bg-[#131722] rounded-xl overflow-hidden border border-neutral-800 flex-shrink-0">
                  ${imagePath ? `<img src="${imagePath}" class="w-full h-full object-cover">` : `<span class="text-[9px] font-cyber text-neutral-500">AGR</span>`}
                </div>

                <div class="flex-1 space-y-1 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="font-mono font-bold text-[10px] text-neutral-400">COD: ${i.sku}</span>
                    <span class="font-display font-black text-[#C8232B]">S/ ${itemTotal}</span>
                  </div>

                  <h5 class="font-bold text-white line-clamp-1">${i.descripcion}</h5>
                  <span class="inline-block bg-[#131722] text-neutral-300 text-[10px] px-2 py-0.5 rounded-md font-semibold border border-neutral-800">
                    Talla: ${variantDisplay}
                  </span>

                  <div class="flex items-center justify-between pt-1">
                    <div class="flex items-center bg-[#131722] border border-neutral-800 rounded-lg">
                      <button type="button" onclick="updateCartItemQty('${i.cartId}', -1)" class="px-2 py-0.5 text-neutral-400 hover:text-white font-bold">-</button>
                      <span class="px-2 py-0.5 font-mono font-bold text-white text-[11px]">${i.cantidad}</span>
                      <button type="button" onclick="updateCartItemQty('${i.cartId}', 1)" class="px-2 py-0.5 text-neutral-400 hover:text-white font-bold">+</button>
                    </div>

                    <button onclick="removeFromCart('${i.cartId}')" type="button" class="text-neutral-500 hover:text-[#C8232B] transition p-1">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      lucide.createIcons();
    }

    function openCartDrawer() {
      document.getElementById('cart-drawer-backdrop').classList.remove('hidden');
    }

    function closeCartDrawer() {
      document.getElementById('cart-drawer-backdrop').classList.add('hidden');
    }

    function sendOrderToWhatsApp() {
      const selectedItems = cart.filter(i => i.selected !== false);
      if (selectedItems.length === 0) {
        showToast('Selecciona al menos un producto de la cesta.', 'warning');
        return;
      }

      const buyerName = document.getElementById('cart-buyer-name')?.value.trim();
      const buyerCity = document.getElementById('cart-buyer-city')?.value.trim();

      let clientName = "Cliente Web";
      if (buyerName && buyerCity) {
        clientName = `${buyerName} (${buyerCity})`;
      } else if (buyerName) {
        clientName = buyerName;
      } else if (buyerCity) {
        clientName = `Cliente (${buyerCity})`;
      }

      let msg = `🛒 *PEDIDO MAYORISTA - AGR IMPORTACIONES*\n`;
      msg += `Cliente: ${clientName}\n\n`;

      let totalAmount = 0;
      const skuCodes = [];

      selectedItems.forEach(i => {
        const subtotal = i.precio_venta * i.cantidad;
        totalAmount += subtotal;
        const variantStr = i.variante_seleccionada || i.variante || 'Único';
        msg += `▪ ${i.descripcion} (Variante: ${variantStr})\n  Cant: ${i.cantidad} x S/.${formatMoney(i.precio_venta)} = S/.${formatMoney(subtotal)}\n\n`;
        skuCodes.push(`${i.sku}:${i.cantidad}`);
      });

      msg += `*TOTAL A PAGAR: S/.${formatMoney(totalAmount)}*\n`;
      msg += `Hola AGR Importaciones, confirmo este pedido para coordinar el pago y el despacho de la mercadería.\n\n`;
      msg += `CODIGO_PEDIDO:[${skuCodes.join(',')}]`;

      const targetURL = `https://wa.me/51992410709?text=${encodeURIComponent(msg)}`;
      window.open(targetURL, '_blank');
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      let bgColor = 'bg-[#131722] border-neutral-700 text-white';
      if (type === 'success') bgColor = 'bg-red-950/90 border-[#C8232B] text-white';
      if (type === 'warning') bgColor = 'bg-amber-950/90 border-amber-700 text-amber-200';
      if (type === 'error') bgColor = 'bg-red-950/90 border-red-700 text-red-200';

      toast.className = `p-3.5 rounded-2xl border shadow-2xl text-xs font-bold flex items-center gap-2.5 transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 ${bgColor}`;
      toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-triangle' : 'info'}" class="w-4 h-4 flex-shrink-0 text-[#C8232B]"></i>
        <span class="flex-1">${message}</span>
      `;

      container.appendChild(toast);
      lucide.createIcons();

      setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      }, 10);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }
  