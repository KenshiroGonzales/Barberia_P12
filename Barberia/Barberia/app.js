const PRODUCTS_API_URL = 'https://6aff19c03a0e70bc8d549b26.mockapi.io/v1/Barberia';
const RESERVAS_API_URL = 'https://6aff19c03a0e70bc8d549b26.mockapi.io/v1/reservas';

const ADMIN_CREDENTIALS = {
  email: 'admin@gmail.com',
  password: '0712@'
};

// 15 turnos diarios por barbero entre 08:00 AM y 08:00 PM con 1 hora de descanso al mediodía (12:30 PM - 01:30 PM)
const DAILY_SLOTS = [
  { id: '08:00', label: '08:00 AM', period: 'Mañana' },
  { id: '08:45', label: '08:45 AM', period: 'Mañana' },
  { id: '09:30', label: '09:30 AM', period: 'Mañana' },
  { id: '10:15', label: '10:15 AM', period: 'Mañana' },
  { id: '11:00', label: '11:00 AM', period: 'Mañana' },
  { id: '11:45', label: '11:45 AM', period: 'Mañana' },
  { id: 'BREAK', label: '12:30 PM – 01:30 PM', isBreak: true },
  { id: '13:30', label: '01:30 PM', period: 'Tarde' },
  { id: '14:15', label: '02:15 PM', period: 'Tarde' },
  { id: '15:00', label: '03:00 PM', period: 'Tarde' },
  { id: '15:45', label: '03:45 PM', period: 'Tarde' },
  { id: '16:30', label: '04:30 PM', period: 'Tarde' },
  { id: '17:15', label: '05:15 PM', period: 'Tarde' },
  { id: '18:00', label: '06:00 PM', period: 'Noche' },
  { id: '18:45', label: '06:45 PM', period: 'Noche' },
  { id: '19:20', label: '07:20 PM', period: 'Noche' }
];

let products = [];
let reservations = [];
let selectedBarber = 'Mateo';
let selectedTime = null;
let selectedCategory = 'Todos';
let cart = [];
let isAdminLoggedIn = sessionStorage.getItem('barber_admin_auth') === 'true';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('booking-date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;
  dateInput.min = today;
  document.getElementById('summary-date').textContent = today;

  dateInput.addEventListener('change', (e) => {
    selectedTime = null;
    document.getElementById('summary-date').textContent = e.target.value;
    document.getElementById('summary-time').textContent = 'Selecciona un horario';
    renderBookingState();
  });

  syncAdminUI();
  fetchAllData();
});

// --- AUTENTICACIÓN DE ADMINISTRADOR ---
function handleAdminButtonClick() {
  if (isAdminLoggedIn) {
    document.getElementById('admin-panel').scrollIntoView({ behavior: 'smooth' });
  } else {
    document.getElementById('login-error-msg').classList.add('hidden');
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-password').value = '';
    const modal = document.getElementById('admin-login-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeLoginModal() {
  const modal = document.getElementById('admin-login-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value.trim();

  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    isAdminLoggedIn = true;
    sessionStorage.setItem('barber_admin_auth', 'true');
    closeLoginModal();
    syncAdminUI();
    renderAdminTable();
    renderBookingState();
    showToast('Bienvenido, Administrador');
  } else {
    document.getElementById('login-error-msg').classList.remove('hidden');
  }
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  sessionStorage.removeItem('barber_admin_auth');
  syncAdminUI();
  renderBookingState();
  showToast('Sesión de administrador cerrada');
}

function syncAdminUI() {
  const panel = document.getElementById('admin-panel');
  const label = document.getElementById('btn-admin-label');
  const btn = document.getElementById('btn-admin-access');

  if (isAdminLoggedIn) {
    panel.classList.remove('hidden');
    label.textContent = 'Panel Admin';
    btn.classList.add('border-[#D4AF37]', 'text-white');
  } else {
    panel.classList.add('hidden');
    label.textContent = 'Acceso Admin';
    btn.classList.remove('border-[#D4AF37]', 'text-white');
  }
}

// --- NORMALIZACIÓN DINÁMICA DE MOCKAPI ---
function normalizeProduct(item) {
  const name = item.name || item.nombre || item.title || `Producto #${item.id}`;
  const rawPrice = item.precio ?? item.price ?? 0;
  const parsedPrice = parseFloat(String(rawPrice).replace(/[^0-9.-]+/g, ''));
  const price = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 55;
  const category = item.categoria || item.category || 'Barbería';
  const stock = item.stock ?? item.cantidad ?? 10;
  const description = item.Description || item.descripcion || item.description || 'Producto profesional de barbería y cuidado personal.';
  const image = item.avatar || item.imagen || item.image || '';
  return { ...item, _name: name, _price: price, _category: category, _stock: stock, _description: description, _image: image };
}

function normalizeReservation(item) {
  const rawName = String(item.name ?? '').trim();
  const rawFecha = String(item.fecha ?? '').trim();
  const rawHora = String(item.hora ?? '').trim();

  // Ignora placeholders por defecto si el registro aún no tiene cliente real
  const hasRealClient = rawName !== '' && !/^name\s*\d+$/i.test(rawName);
  const hasRealDate = rawFecha !== '' && !/^fecha\s*\d+$/i.test(rawFecha);
  const hasRealHora = rawHora !== '' && !/^hora\s*\d+$/i.test(rawHora);

  // Soporta formatos como "Mateo - 09:00 AM" o solo "09:00 AM"
  let barber = '';
  let slotLabel = rawHora;
  if (hasRealHora && rawHora.includes(' - ')) {
    const parts = rawHora.split(' - ');
    barber = parts[0].trim();
    slotLabel = parts[1].trim();
  }

  return {
    ...item,
    _name: hasRealClient ? rawName : '',
    _fecha: hasRealDate ? rawFecha : '',
    _hora: hasRealHora ? rawHora : '',
    _barber: barber,
    _slotLabel: slotLabel,
    _isValidBooking: hasRealClient && hasRealHora
  };
}

async function fetchAllData() {
  setApiStatus('loading', 'Sincronizando...');
  try {
    const [prodRes, resvRes] = await Promise.all([
      fetch(PRODUCTS_API_URL),
      fetch(RESERVAS_API_URL)
    ]);

    if (!prodRes.ok || !resvRes.ok) {
      throw new Error(`HTTP ${prodRes.status} / ${resvRes.status}`);
    }

    const [prodData, resvData] = await Promise.all([
      prodRes.json(),
      resvRes.json()
    ]);

    products = Array.isArray(prodData) ? prodData.map(normalizeProduct) : [];
    reservations = Array.isArray(resvData) ? resvData.map(normalizeReservation) : [];

    setApiStatus('online', 'En línea');
    renderBookingState();
    renderCategoryFilters();
    renderProducts();
    if (isAdminLoggedIn) renderAdminTable();
  } catch (err) {
    console.error('Error sincronizando MockAPI:', err);
    setApiStatus('error', 'Sin conexión');
    showToast('Error al conectar con /Barberia o /reservas.');
  }
}

function setApiStatus(state, text) {
  const dot = document.getElementById('api-status-dot');
  const label = document.getElementById('api-status-text');
  label.textContent = text;
  dot.className = 'w-2 h-2 rounded-full ' + (
    state === 'online' ? 'bg-emerald-400' :
    state === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'
  );
}

// --- LÓGICA DE RESERVAS (15 POR BARBERO / 30 AL DÍA + /reservas) ---
function selectBarber(barberName) {
  selectedBarber = barberName;
  selectedTime = null;
  document.getElementById('selected-barber-label').textContent = barberName;
  document.getElementById('summary-barber').textContent = barberName;
  document.getElementById('summary-time').textContent = 'Selecciona un horario';

  document.querySelectorAll('.barber-card').forEach(btn => {
    const isSelected = btn.dataset.barber === barberName;
    btn.className = isSelected
      ? 'barber-card active text-left p-4 rounded-xl border border-[#D4AF37] bg-[#1C1C21] transition-all flex items-center justify-between'
      : 'barber-card text-left p-4 rounded-xl border border-[#26262C] bg-[#0B0B0D] hover:border-[#3f3f46] transition-all flex items-center justify-between';
  });

  renderBookingState();
}

function isBookingForDateAndBarber(r, dateStr, barberName) {
  if (!r._isValidBooking) return false;
  if (r._fecha && r._fecha !== dateStr) return false;
  if (r._barber) {
    return r._barber.toLowerCase() === barberName.toLowerCase();
  }
  return barberName === 'Mateo';
}

function renderBookingState() {
  const currentDate = document.getElementById('booking-date').value;

  const mateoBooked = reservations.filter(r => isBookingForDateAndBarber(r, currentDate, 'Mateo'));
  const lucasBooked = reservations.filter(r => isBookingForDateAndBarber(r, currentDate, 'Lucas'));

  const mateoFree = Math.max(0, 15 - mateoBooked.length);
  const lucasFree = Math.max(0, 15 - lucasBooked.length);

  document.getElementById('stat-barber-1').textContent = mateoFree;
  document.getElementById('stat-barber-2').textContent = lucasFree;
  document.getElementById('stat-available-total').textContent = mateoFree + lucasFree;
  document.getElementById('badge-Mateo').textContent = `${mateoFree} libres`;
  document.getElementById('badge-Lucas').textContent = `${lucasFree} libres`;

  const grid = document.getElementById('time-slots-grid');
  const activeBarberBooked = selectedBarber === 'Mateo' ? mateoBooked : lucasBooked;
  const occupiedLabels = activeBarberBooked.map(r => r._slotLabel);

  grid.innerHTML = DAILY_SLOTS.map(slot => {
    if (slot.isBreak) {
      return `
        <div class="col-span-2 sm:col-span-3 md:col-span-4 py-2.5 px-4 rounded-xl bg-[#0B0B0D] border border-dashed border-[#26262C] text-center text-xs text-[#A1A1AA] flex items-center justify-center gap-2">
          <span>☕</span>
          <span>Descanso del Personal (${slot.label})</span>
        </div>
      `;
    }

    const isOccupied = occupiedLabels.includes(slot.label) || occupiedLabels.includes(slot.id);
    const isSelected = selectedTime && selectedTime.id === slot.id;

    if (isOccupied) {
      return `
        <button type="button" disabled class="py-2.5 px-3 rounded-xl bg-red-950/30 border border-red-900/40 text-red-400/70 text-xs font-medium cursor-not-allowed flex flex-col items-center">
          <span>${slot.label}</span>
          <span class="text-[10px] uppercase tracking-wider mt-0.5">Reservado</span>
        </button>
      `;
    }

    return `
      <button type="button" onclick="selectTimeSlot('${slot.id}', '${slot.label}')" class="py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center ${
        isSelected
          ? 'bg-[#D4AF37] border-[#D4AF37] text-[#0B0B0D] shadow-md shadow-[#D4AF37]/20'
          : 'bg-[#0B0B0D] border-[#26262C] text-white hover:border-[#D4AF37]/70'
      }">
        <span>${slot.label}</span>
        <span class="text-[10px] font-normal ${isSelected ? 'text-[#0B0B0D]/80' : 'text-[#A1A1AA]'} mt-0.5">${slot.period}</span>
      </button>
    `;
  }).join('');

  // Listado de reservas del día en /reservas
  const dayBookings = reservations.filter(r => r._isValidBooking && (!r._fecha || r._fecha === currentDate));
  const listEl = document.getElementById('bookings-list');

  if (dayBookings.length === 0) {
    listEl.innerHTML = `<p class="text-xs text-[#A1A1AA] col-span-full py-4 text-center">No hay turnos agendados para el ${currentDate}. ¡Los 30 cupos están libres!</p>`;
  } else {
    listEl.innerHTML = dayBookings.map(b => `
      <div class="p-3.5 rounded-xl bg-[#0B0B0D] border border-[#26262C] flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-[#D4AF37]">${escapeHtml(b._slotLabel)}</span>
            ${b._barber ? `<span class="text-[11px] px-2 py-0.5 rounded bg-[#141417] text-white border border-[#26262C]">${escapeHtml(b._barber)}</span>` : ''}
          </div>
          <p class="text-sm font-medium text-white mt-1">${escapeHtml(b._name)}</p>
          <p class="text-[11px] text-[#A1A1AA]">${escapeHtml(b._fecha || currentDate)}</p>
        </div>
        ${isAdminLoggedIn ? `
          <button onclick="deleteReservation('${b.id}')" title="Cancelar turno" class="px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 hover:bg-red-950/60 transition-colors text-xs">
            Cancelar
          </button>
        ` : ''}
      </div>
    `).join('');
  }
}

function selectTimeSlot(id, label) {
  selectedTime = { id, label };
  document.getElementById('summary-time').textContent = label;
  renderBookingState();
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  if (!selectedTime) {
    showToast('Por favor selecciona un horario disponible primero.');
    return;
  }

  const currentDate = document.getElementById('booking-date').value;
  const barberBookings = reservations.filter(r => isBookingForDateAndBarber(r, currentDate, selectedBarber));

  if (barberBookings.length >= 15) {
    showToast(`${selectedBarber} ya alcanzó su límite de 15 cortes para este día.`);
    return;
  }

  const btn = document.getElementById('btn-submit-booking');
  btn.disabled = true;
  btn.textContent = 'Guardando en /reservas...';

  const payload = {
    name: document.getElementById('client-name').value.trim(),
    fecha: currentDate,
    hora: `${selectedBarber} - ${selectedTime.label}`
  };

  try {
    const res = await fetch(RESERVAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error al guardar reserva');

    document.getElementById('booking-form').reset();
    selectedTime = null;
    document.getElementById('summary-time').textContent = 'Selecciona un horario';
    showToast(`¡Turno reservado con ${selectedBarber} a las ${payload.hora.split(' - ')[1]}!`);
    await fetchAllData();
  } catch (err) {
    console.error(err);
    showToast('Error al registrar la reserva en /reservas.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Reserva';
  }
}

async function deleteReservation(id) {
  if (!isAdminLoggedIn) return;
  if (!confirm('¿Seguro que deseas cancelar este turno en /reservas?')) return;
  try {
    const res = await fetch(`${RESERVAS_API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar reserva');
    showToast('Turno cancelado en /reservas');
    await fetchAllData();
  } catch (err) {
    console.error(err);
    showToast('No se pudo cancelar el turno.');
  }
}

// --- TIENDA CLIENTE + VER MÁS DETALLES (/Barberia) ---
function renderCategoryFilters() {
  document.getElementById('stat-products').textContent = products.length;
  const categories = ['Todos', ...new Set(products.map(p => p._category).filter(Boolean))];
  const container = document.getElementById('category-filters');

  container.innerHTML = categories.map(cat => {
    const active = selectedCategory === cat;
    return `
      <button onclick="setCategoryFilter('${escapeHtml(cat)}')" class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-[#D4AF37] text-[#0B0B0D]'
          : 'bg-[#141417] text-[#A1A1AA] border border-[#26262C] hover:text-white'
      }">
        ${escapeHtml(cat)}
      </button>
    `;
  }).join('');
}

function setCategoryFilter(cat) {
  selectedCategory = cat;
  renderCategoryFilters();
  renderProducts();
}

function renderProducts() {
  const query = document.getElementById('product-search').value.toLowerCase().trim();
  const grid = document.getElementById('products-grid');

  const filtered = products.filter(p => {
    const matchesCat = selectedCategory === 'Todos' || p._category === selectedCategory;
    const matchesText = p._name.toLowerCase().includes(query) ||
                        p._description.toLowerCase().includes(query) ||
                        p._category.toLowerCase().includes(query);
    return matchesCat && matchesText;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full p-12 rounded-2xl bg-[#141417] border border-[#26262C] text-center">
        <p class="text-white font-semibold">No hay productos disponibles con ese filtro</p>
        <p class="text-xs text-[#A1A1AA] mt-1">Intenta con otro término de búsqueda.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="group rounded-2xl bg-[#141417] border border-[#26262C] hover:border-[#D4AF37]/50 overflow-hidden flex flex-col justify-between transition-all">
      <div>
        <div onclick="openDetailModal('${p.id}')" class="cursor-pointer relative aspect-[4/3] bg-[#0B0B0D] overflow-hidden flex items-center justify-center">
          ${p._image
            ? `<img src="${escapeHtml(p._image)}" alt="${escapeHtml(p._name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
               <div class="hidden w-full h-full items-center justify-center text-[#26262C] font-display font-bold text-2xl">BARBER SHOP</div>`
            : `<div class="w-full h-full flex items-center justify-center text-[#26262C] font-display font-bold text-xl tracking-widest">BARBER SHOP</div>`
          }
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#0B0B0D]/85 backdrop-blur text-[11px] font-medium text-[#D4AF37] border border-[#26262C]">
            ${escapeHtml(p._category)}
          </span>
        </div>

        <div class="p-5">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-white text-base leading-snug">${escapeHtml(p._name)}</h3>
            <span class="font-display font-bold text-[#D4AF37] text-base whitespace-nowrap">Bs ${p._price.toFixed(2)}</span>
          </div>
          <p class="text-xs text-[#A1A1AA] mt-2 line-clamp-2 leading-relaxed">${escapeHtml(p._description)}</p>
        </div>
      </div>

      <div class="px-5 pb-5 pt-2 flex items-center justify-between gap-2">
        <button onclick="openDetailModal('${p.id}')" class="px-3 py-2 rounded-xl bg-[#1C1C21] hover:bg-[#26262C] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors">
          Ver detalles
        </button>
        <button onclick="addToCart('${p.id}')" class="px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#e0bc46] text-[#0B0B0D] text-xs font-semibold transition-all">
          + Añadir
        </button>
      </div>
    </div>
  `).join('');
}

function openDetailModal(productId) {
  const prod = products.find(p => String(p.id) === String(productId));
  if (!prod) return;

  document.getElementById('detail-img').src = prod._image || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80';
  document.getElementById('detail-category').textContent = prod._category;
  document.getElementById('detail-id').textContent = `Código #${prod.id}`;
  document.getElementById('detail-name').textContent = prod._name;
  document.getElementById('detail-price').textContent = `Bs ${prod._price.toFixed(2)}`;
  document.getElementById('detail-description').textContent = prod._description;
  document.getElementById('detail-stock').textContent = `${prod._stock} unidades`;

  document.getElementById('detail-add-btn').onclick = () => {
    addToCart(prod.id);
    closeDetailModal();
  };

  const modal = document.getElementById('product-detail-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeDetailModal() {
  const modal = document.getElementById('product-detail-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// --- CRUD ADMIN EN /Barberia ---
function renderAdminTable() {
  const tbody = document.getElementById('admin-products-tbody');
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-xs text-[#A1A1AA]">No hay productos registrados en /Barberia.</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr class="hover:bg-[#141417]/70 transition-colors">
      <td class="py-3 px-4 text-xs text-[#A1A1AA]">#${escapeHtml(p.id)}</td>
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <img src="${escapeHtml(p._image)}" alt="" onerror="this.style.display='none'" class="w-10 h-10 rounded-lg object-cover bg-[#141417] border border-[#26262C]" />
          <div>
            <p class="font-medium text-white text-sm">${escapeHtml(p._name)}</p>
            <span class="text-[11px] text-[#D4AF37]">${escapeHtml(p._category)}</span>
          </div>
        </div>
      </td>
      <td class="py-3 px-4 text-xs text-[#A1A1AA] max-w-xs truncate hidden md:table-cell">${escapeHtml(p._description)}</td>
      <td class="py-3 px-4 text-xs font-semibold text-white whitespace-nowrap">Bs ${p._price.toFixed(2)}</td>
      <td class="py-3 px-4 text-xs text-[#A1A1AA]">${p._stock}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <div class="inline-flex items-center gap-1.5">
          <button onclick="openDetailModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-[#141417] border border-[#26262C] hover:border-white/40 text-xs text-[#A1A1AA] hover:text-white">Ver</button>
          <button onclick="openProductModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-[#141417] border border-[#26262C] hover:border-[#D4AF37] text-xs text-[#D4AF37]">Editar</button>
          <button onclick="deleteProduct('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-950/30 border border-red-900/40 hover:bg-red-950/60 text-xs text-red-400">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openProductModal(productId = null) {
  if (!isAdminLoggedIn) return;
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  form.reset();

  if (productId) {
    const prod = products.find(p => String(p.id) === String(productId));
    if (prod) {
      document.getElementById('modal-product-title').textContent = 'Editar Producto en /Barberia';
      document.getElementById('prod-id').value = prod.id;
      document.getElementById('prod-name').value = prod._name;
      document.getElementById('prod-price').value = prod._price;
      document.getElementById('prod-stock').value = prod._stock;
      document.getElementById('prod-category').value = prod._category;
      document.getElementById('prod-image').value = prod._image;
      document.getElementById('prod-description').value = prod._description;
    }
  } else {
    document.getElementById('modal-product-title').textContent = 'Nuevo Producto en /Barberia';
    document.getElementById('prod-id').value = '';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  if (!isAdminLoggedIn) return;

  const id = document.getElementById('prod-id').value;
  const btn = document.getElementById('btn-save-product');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const payload = {
    name: document.getElementById('prod-name').value.trim(),
    avatar: document.getElementById('prod-image').value.trim(),
    Description: document.getElementById('prod-description').value.trim(),
    precio: parseFloat(document.getElementById('prod-price').value) || 55,
    stock: parseInt(document.getElementById('prod-stock').value, 10) || 10,
    categoria: document.getElementById('prod-category').value.trim() || 'Barbería'
  };

  try {
    const url = id ? `${PRODUCTS_API_URL}/${id}` : PRODUCTS_API_URL;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Error guardando producto');

    closeProductModal();
    showToast(id ? 'Producto actualizado en MockAPI' : 'Producto creado en MockAPI');
    await fetchAllData();
  } catch (err) {
    console.error(err);
    showToast('Error al guardar el producto.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar en MockAPI';
  }
}

async function deleteProduct(id) {
  if (!isAdminLoggedIn) return;
  if (!confirm('¿Seguro que deseas eliminar este producto de /Barberia?')) return;
  try {
    const res = await fetch(`${PRODUCTS_API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar');
    showToast('Producto eliminado de /Barberia');
    await fetchAllData();
  } catch (err) {
    console.error(err);
    showToast('No se pudo eliminar el producto.');
  }
}

// --- CARRITO DE COMPRAS ---
function addToCart(productId) {
  const prod = products.find(p => String(p.id) === String(productId));
  if (!prod) return;

  const existing = cart.find(item => String(item.id) === String(productId));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: prod.id, name: prod._name, price: prod._price, qty: 1 });
  }
  updateCartUI();
  showToast(`"${prod._name}" añadido al carrito`);
}

function updateCartQty(productId, delta) {
  const idx = cart.findIndex(item => String(item.id) === String(productId));
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartUI();
}

function updateCartUI() {
  const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
  const totalPrice = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  document.getElementById('cart-count').textContent = totalQty;
  document.getElementById('cart-total').textContent = `Bs ${totalPrice.toFixed(2)}`;

  const itemsContainer = document.getElementById('cart-items');
  if (cart.length === 0) {
    itemsContainer.innerHTML = `<p class="text-xs text-[#A1A1AA] text-center py-10">Tu carrito está vacío.</p>`;
    return;
  }

  itemsContainer.innerHTML = cart.map(item => `
    <div class="p-3 rounded-xl bg-[#0B0B0D] border border-[#26262C] flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-white">${escapeHtml(item.name)}</p>
        <p class="text-xs text-[#D4AF37]">Bs ${(item.price * item.qty).toFixed(2)}</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="updateCartQty('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-[#141417] border border-[#26262C] text-white text-xs">-</button>
        <span class="text-xs font-semibold w-5 text-center">${item.qty}</span>
        <button onclick="updateCartQty('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-[#141417] border border-[#26262C] text-white text-xs">+</button>
      </div>
    </div>
  `).join('');
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  if (open) {
    drawer.classList.remove('hidden');
    drawer.classList.add('flex');
  } else {
    drawer.classList.add('hidden');
    drawer.classList.remove('flex');
  }
}

function checkoutCart() {
  if (cart.length === 0) {
    showToast('Agrega productos antes de finalizar el pedido.');
    return;
  }
  cart = [];
  updateCartUI();
  toggleCartDrawer(false);
  showToast('¡Pedido confirmado! Puedes recogerlo en Barber Shop.');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3200);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}