/** Adminpanelen (/admin/): inloggning, flikar och laddning av ordrar. */
import {
  AdminOrdersResponseSchema,
  OkResponseSchema,
  type Order,
  type Role,
  SessionResponseSchema,
  StatusUpdateResponseSchema,
} from '../../shared/apiTypes.ts';
import type { OrderStatus } from '../../shared/orderStatus.ts';
import { ApiError, apiGet, apiPost } from '../api.ts';
import { byId } from '../dom.ts';
import { initOrdersView, replaceOrder, setOrders } from './ordersView.ts';
import { initPosterView } from './posterView.ts';
import { renderSummary } from './summaryView.ts';

const loginView = byId('login-view', HTMLElement);
const appView = byId('app-view', HTMLElement);
const loginForm = byId('login-form', HTMLFormElement);
const loginError = byId('login-error', HTMLParagraphElement);
const roleBadge = byId('role-badge', HTMLSpanElement);
const demoBanner = byId('demo-banner', HTMLParagraphElement);
const loadError = byId('load-error', HTMLParagraphElement);

let orders: Order[] = [];
let posterReady = false;

function showLogin(): void {
  appView.hidden = true;
  loginView.hidden = false;
  byId('username', HTMLInputElement).focus();
}

async function loadOrders(): Promise<void> {
  loadError.hidden = true;
  try {
    const response = await apiGet('/api/admin/orders', AdminOrdersResponseSchema);
    orders = response.orders;
    setOrders(orders);
    renderSummary(orders);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLogin();
      return;
    }
    loadError.textContent = error instanceof Error ? error.message : 'Kunde inte hämta ordrar.';
    loadError.hidden = false;
  }
}

function showApp(role: Role): void {
  loginView.hidden = true;
  appView.hidden = false;
  roleBadge.textContent = role === 'demo' ? 'Demo' : 'Admin';
  demoBanner.hidden = role !== 'demo';
  void loadOrders();
}

async function changeStatus(order: Order, status: OrderStatus): Promise<void> {
  const response = await apiPost(
    '/api/admin/orders/status',
    { orderNumber: order.orderNumber, status },
    StatusUpdateResponseSchema,
  );
  orders = orders.map((o) => (o.orderNumber === response.order.orderNumber ? response.order : o));
  replaceOrder(response.order);
  renderSummary(orders);
}

async function saveTracking(order: Order, trackingNumber: string): Promise<void> {
  const response = await apiPost(
    '/api/admin/orders/tracking',
    { orderNumber: order.orderNumber, trackingNumber },
    StatusUpdateResponseSchema,
  );
  orders = orders.map((o) => (o.orderNumber === response.order.orderNumber ? response.order : o));
  replaceOrder(response.order);
}

function selectTab(name: string): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const selected = tab.dataset['tab'] === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(`panel-${tab.dataset['tab'] ?? ''}`);
    if (panel !== null) panel.hidden = !selected;
  }
  if (name === 'qr' && !posterReady) {
    initPosterView();
    posterReady = true;
  }
}

async function login(): Promise<void> {
  const data = new FormData(loginForm);
  const button = loginForm.querySelector('button');
  loginError.hidden = true;
  if (button !== null) button.disabled = true;
  try {
    const response = await apiPost(
      '/api/admin/login',
      { username: data.get('username'), password: data.get('password') },
      SessionResponseSchema,
    );
    loginForm.reset();
    showApp(response.role);
  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : 'Inloggningen misslyckades.';
    loginError.hidden = false;
  } finally {
    if (button !== null) button.disabled = false;
  }
}

async function init(): Promise<void> {
  initOrdersView(changeStatus, saveTracking);
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void login();
  });
  byId('logout', HTMLButtonElement).addEventListener('click', () => {
    void apiPost('/api/admin/logout', {}, OkResponseSchema)
      .catch(() => null)
      .finally(() => {
        orders = [];
        setOrders([]);
        showLogin();
      });
  });
  byId('refresh', HTMLButtonElement).addEventListener('click', () => {
    void loadOrders();
  });
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    tab.addEventListener('click', () => {
      selectTab(tab.dataset['tab'] ?? 'orders');
    });
  }

  try {
    const session = await apiGet('/api/admin/me', SessionResponseSchema);
    showApp(session.role);
  } catch {
    showLogin();
  }
}

void init();
