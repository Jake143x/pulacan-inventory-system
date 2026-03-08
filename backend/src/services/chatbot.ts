import { getLatestPredictions } from './aiAnalytics.js';
import { createNotificationForCashiers } from './notifications.js';
import { prisma } from '../lib/prisma.js';

/**
 * AI chat assistant: reads automatically from the database on every request.
 * No stored conversation or cached product list — each message triggers live
 * queries (Product, Inventory, OnlineOrder, etc.) via Prisma.
 */

const CASHIER_CURRENCY = '₱';
const CUSTOMER_CURRENCY = '₱';

type Intent =
  | 'inventory_summary'
  | 'low_stock'
  | 'sales_summary'
  | 'demand_prediction'
  | 'best_selling'
  | 'product_suggestions'
  | 'reorder_what'
  | 'sales_forecast'
  | 'unknown';

type CashierIntent = 'stock_product' | 'price_product' | 'add_item' | 'discount' | 'receipt' | 'return' | 'help' | 'unknown';

type CustomerIntent =
  | 'connect_to_cashier'
  | 'order_status'
  | 'product_price'
  | 'product_stock'
  | 'product_specs'
  | 'shipping_info'
  | 'payment_options'
  | 'customer_help'
  | 'unknown';

function detectCustomerIntent(message: string): { intent: CustomerIntent; productQuery?: string } {
  const lower = message.toLowerCase().trim();
  const trimmed = message.trim();
  if (
    /connect\s+to\s+(?:cashier|staff|agent)/.test(lower) ||
    /talk\s+to\s+(?:a\s+)?cashier/.test(lower) ||
    /speak\s+to\s+(?:cashier|staff)/.test(lower) ||
    /(?:need|want)\s+(?:to\s+)?(?:talk|speak)\s+to/.test(lower) ||
    /customer\s+support|live\s+agent|real\s+person|human\s+help/.test(lower) ||
    lower === 'connect to cashier' ||
    lower === 'talk to cashier'
  )
    return { intent: 'connect_to_cashier' };
  if (/\b(?:where is|status of|track)\s+my\s+order/.test(lower) || /\bmy\s+orders?\b/.test(lower) || /\border\s+status\b/.test(lower))
    return { intent: 'order_status' };
  const priceMatch = lower.match(/(?:price|how much|cost)\s+(?:of\s+)?(.+)/);
  if (priceMatch) return { intent: 'product_price', productQuery: priceMatch[1].trim() };
  const stockMatch = lower.match(/(?:stock|availability|in stock|do you have)\s+(?:for\s+)?(.+)/);
  if (stockMatch) return { intent: 'product_stock', productQuery: stockMatch[1].trim() };
  const specsMatch = lower.match(/(?:specs?|specification|details?|info(?:rmation)?)\s+(?:of|for|on)\s+(.+)/);
  if (specsMatch) return { intent: 'product_specs', productQuery: specsMatch[1].trim() };
  const giveSpecsMatch = lower.match(/give\s+me\s+(?:the\s+)?(?:specs?|details?)\s+(?:of|for)\s+(.+)/);
  if (giveSpecsMatch) return { intent: 'product_specs', productQuery: giveSpecsMatch[1].trim() };
  if (/\bshipping\b|\bdelivery\b|\bdeliver\b/.test(lower)) return { intent: 'shipping_info' };
  if (/\bpayment\b|\bpay\b|\bgcash\b|\bcod\b|\bdebit\b/.test(lower)) return { intent: 'payment_options' };
  if (/\bhelp\b/.test(lower) || /\bwhat\s+can\s+you\b/.test(lower)) return { intent: 'customer_help' };
  // "how about nails?", "what about cement?", "tell me about hammer" → treat as product lookup (no storage, live lookup only)
  const aboutMatch = lower.match(/(?:how|what)\s+about\s+(.+)/);
  if (aboutMatch) return { intent: 'product_price', productQuery: aboutMatch[1].trim() };
  const tellMatch = lower.match(/(?:tell\s+me\s+about|info\s+on|information\s+about)\s+(.+)/);
  if (tellMatch) return { intent: 'product_price', productQuery: tellMatch[1].trim() };
  // Any short query (e.g. "cement", "nails", "lumber") → try product lookup from database
  if (trimmed.length > 0 && trimmed.length < 80) return { intent: 'product_price', productQuery: trimmed };
  return { intent: 'unknown' };
}

/** Normalize product search: strip punctuation and use best token for DB lookup. */
function normalizeProductQuery(q: string): string[] {
  const cleaned = q.replace(/[?!.,;:]$/g, '').trim();
  if (!cleaned) return [];
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return [cleaned];
  return [cleaned, ...tokens].filter((v, i, a) => a.indexOf(v) === i);
}

/** Product row with inventory for chatbot responses. */
type ProductForChat = {
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number;
  unitType: string;
  saleUnit: string | null;
  specifications: string | null;
  inventory: { quantity: number } | null;
};

/** Search products by name (flexible ILIKE). Uses live DB so admin updates are reflected. */
async function searchProductsByName(query: string, limit = 10): Promise<ProductForChat[]> {
  const terms = normalizeProductQuery(query);
  for (const term of terms) {
    if (!term) continue;
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        name: { contains: term, mode: 'insensitive' },
      },
      select: {
        name: true,
        description: true,
        category: true,
        unitPrice: true,
        unitType: true,
        saleUnit: true,
        specifications: true,
        inventory: { select: { quantity: true } },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
    if (products.length > 0) return products as ProductForChat[];
  }
  return [];
}

/** Get similar product names when exact match not found (e.g. by category or partial word). */
async function getSimilarProductsForChat(query: string, limit = 5): Promise<string[]> {
  const words = query.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) {
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: { name: true },
      take: limit,
      orderBy: { name: 'asc' },
    });
    return products.map((p) => p.name);
  }
  const products = await prisma.product.findMany({
    where: {
      status: 'active',
      OR: words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
    },
    select: { name: true },
    take: limit,
    orderBy: { name: 'asc' },
  });
  return [...new Set(products.map((p) => p.name))];
}

/** Format a single product for chatbot: name, description, category, price, stock. */
function formatProductDetails(p: ProductForChat, currency: string): string {
  const lines: string[] = [p.name];
  if (p.description?.trim()) lines.push(p.description.trim());
  const specLabel = p.specifications?.trim() ? `Specs: ${p.specifications.trim()}` : null;
  if (specLabel) lines.push(specLabel);
  const unit = (p.saleUnit || p.unitType || 'piece').toLowerCase();
  const unitLabel = unit === 'kg' ? 'kg' : unit === 'meter' ? 'm' : 'pcs';
  const qty = p.inventory?.quantity ?? 0;
  const stockLine = qty > 0 ? `${qty} ${unitLabel} in stock` : 'Out of stock';
  lines.push(`Price: ${currency}${p.unitPrice.toFixed(2)}`);
  lines.push(`Stock: ${stockLine}`);
  if (p.category?.trim()) lines.push(`Category: ${p.category.trim()}`);
  return lines.join('\n');
}

function detectCashierIntent(message: string): { intent: CashierIntent; productQuery?: string } {
  const lower = message.toLowerCase().trim();
  const stockMatch = lower.match(/(?:stock|check stock|how many)\s+(?:for\s+)?(.+)/);
  if (stockMatch) return { intent: 'stock_product', productQuery: stockMatch[1].trim() };
  const priceMatch = lower.match(/(?:price|how much|cost)\s+(?:of\s+)?(.+)/);
  if (priceMatch) return { intent: 'price_product', productQuery: priceMatch[1].trim() };
  if (/\b(?:add|put)\s+(?:item|product|\d+)/.test(lower) || /\badd\s+to\s+(?:sale|transaction|cart)/.test(lower)) return { intent: 'add_item' };
  if (/\b(?:apply|give|add)\s*(?:\d+%?)?\s*discount/.test(lower) || /\bdiscount\b/.test(lower)) return { intent: 'discount' };
  if (/\b(?:print\s+)?receipt\b/.test(lower)) return { intent: 'receipt' };
  if (/\breturn(s)?\b/.test(lower) || /\bprocess\s+return/.test(lower)) return { intent: 'return' };
  if (/\bhelp\b/.test(lower) || /\bwhat\s+can\s+you\b/.test(lower)) return { intent: 'help' };
  return { intent: 'unknown' };
}

function detectIntent(message: string): Intent {
  const lower = message.toLowerCase().trim();
  if (/\b(inventory|stock|products?)\b/.test(lower) && (/\b(low|alert|threshold)\b/.test(lower) || /\bhow many\b/.test(lower)))
    return 'low_stock';
  if (/\b(reorder|what (should|to) reorder|what to order|reorder list)\b/.test(lower)) return 'reorder_what';
  if (/\b(sales? ?forecast|demand forecast|forecast sales|sales prediction)\b/.test(lower)) return 'sales_forecast';
  if (/\b(inventory|stock)\b/.test(lower) && !/\b(low|alert)\b/.test(lower)) return 'inventory_summary';
  if (/\b(sales?|revenue)\b/.test(lower)) return 'sales_summary';
  if (/\b(demand|predict|forecast|restock)\b/.test(lower)) return 'demand_prediction';
  if (/\b(best selling|top products?)\b/.test(lower)) return 'best_selling';
  if (/\b(suggest|recommend|what (to )?buy)\b/.test(lower)) return 'product_suggestions';
  return 'unknown';
}

export async function chat(userId: number, message: string, role: string): Promise<string> {
  // ——— Cashier: POS Chat Assistant — short, actionable, no analytics ———
  if (role === 'CASHIER') {
    const { intent: cashierIntent, productQuery } = detectCashierIntent(message);

    if (cashierIntent === 'stock_product' && productQuery) {
      const products = await searchProductsByName(productQuery, 5);
      if (products.length === 0) {
        const similar = await getSimilarProductsForChat(productQuery, 5);
        const hint = similar.length > 0 ? ` You might mean: ${similar.join(', ')}.` : '';
        return `Product not found. Please check the name or try another search.${hint}`;
      }
      return products.map((p) => formatProductDetails(p, CASHIER_CURRENCY)).join('\n\n');
    }

    if (cashierIntent === 'price_product' && productQuery) {
      const products = await searchProductsByName(productQuery, 5);
      if (products.length === 0) {
        const similar = await getSimilarProductsForChat(productQuery, 5);
        const hint = similar.length > 0 ? ` You might mean: ${similar.join(', ')}.` : '';
        return `Product not found. Please check the name or try another search.${hint}`;
      }
      return products.map((p) => formatProductDetails(p, CASHIER_CURRENCY)).join('\n\n');
    }

    if (cashierIntent === 'add_item') {
      return 'Add items from the product list on the left, then tap Complete sale.';
    }
    if (cashierIntent === 'discount') {
      return 'Use the discount option in the current sale panel when available. I can’t apply discounts from here.';
    }
    if (cashierIntent === 'receipt') {
      return 'After completing the sale, use the receipt option if enabled on your device.';
    }
    if (cashierIntent === 'return') {
      return 'Process returns via Approve Order or contact a manager.';
    }
    if (cashierIntent === 'help') {
      return 'I can help with: check stock for a product, get price, and short guidance. Try: "Check stock for Hammer", "Price of Common Nails".';
    }

    // Fallback: try product lookup by full message (e.g. "Hammer" → stock)
    const trimmed = message.trim();
    if (trimmed.length > 0 && trimmed.length < 80) {
      const products = await searchProductsByName(trimmed, 3);
      if (products.length > 0) return products.map((p) => formatProductDetails(p, CASHIER_CURRENCY)).join('\n\n');
      const similar = await getSimilarProductsForChat(trimmed, 3);
      if (similar.length > 0) return `Product not found. You might mean: ${similar.join(', ')}.`;
    }
    return 'I can help with: check stock, get price, and quick guidance. Try "Check stock for [product]" or "Price of [product]".';
  }

  // ——— Customer: basic queries + connect to cashier for inquiry ———
  if (role === 'CUSTOMER') {
    const { intent: custIntent, productQuery } = detectCustomerIntent(message);

    if (custIntent === 'connect_to_cashier') {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
      const name = user?.fullName ?? 'A customer';
      const email = user?.email ?? '';
      await createNotificationForCashiers(
        prisma,
        'Customer inquiry',
        `${name} (${email}) is requesting to connect to a cashier for assistance.`,
        'CUSTOMER_INQUIRY'
      );
      return "Your request has been sent. A cashier will assist you shortly. You can also visit our store or call us for immediate help.";
    }

    if (custIntent === 'order_status') {
      const orders = await prisma.onlineOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { items: { include: { product: true } } },
      });
      if (orders.length === 0) return "You don't have any orders yet. Place an order from your cart to see status here.";
      const lines = orders.map((o) => `Order #${o.id}: ${o.status} – Total ${CUSTOMER_CURRENCY}${o.total.toFixed(2)} (${o.createdAt.toISOString().slice(0, 10)}).`);
      return `Your recent orders:\n${lines.join('\n')}\n\nCheck "My Orders" in the menu for full details.`;
    }

    if (custIntent === 'product_price' && productQuery) {
      const products = await searchProductsByName(productQuery, 5);
      if (products.length === 0) {
        const similar = await getSimilarProductsForChat(productQuery, 5);
        const hint = similar.length > 0 ? ` You might be interested in: ${similar.join(', ')}.` : '';
        return `No product found for "${productQuery}". Try browsing our Products page.${hint}`;
      }
      return products.map((p) => formatProductDetails(p, CUSTOMER_CURRENCY)).join('\n\n');
    }

    if (custIntent === 'product_stock' && productQuery) {
      const products = await searchProductsByName(productQuery, 5);
      if (products.length === 0) {
        const similar = await getSimilarProductsForChat(productQuery, 5);
        const hint = similar.length > 0 ? ` You might be interested in: ${similar.join(', ')}.` : '';
        return `No product found for "${productQuery}". Try browsing our Products page.${hint}`;
      }
      return products.map((p) => formatProductDetails(p, CUSTOMER_CURRENCY)).join('\n\n');
    }

    if (custIntent === 'product_specs' && productQuery) {
      const products = await searchProductsByName(productQuery, 3);
      if (products.length === 0) {
        const similar = await getSimilarProductsForChat(productQuery, 5);
        const hint = similar.length > 0 ? ` You might be interested in: ${similar.join(', ')}.` : '';
        return `No product found for "${productQuery}".${hint}`;
      }
      return products.map((p) => formatProductDetails(p, CUSTOMER_CURRENCY)).join('\n\n');
    }

    if (custIntent === 'shipping_info') {
      return 'We offer delivery. Shipping is ₱150 per order; free shipping on orders ₱2,000 and above. Enter your address at checkout. For bulk or special delivery, connect to a cashier.';
    }

    if (custIntent === 'payment_options') {
      return 'We accept: GCash, Debit Card, and Cash on Delivery. Choose your preferred method at checkout. For other options, connect to a cashier.';
    }

    if (custIntent === 'customer_help') {
      return 'I read from the store database and can answer: order status, product price and availability, specs and details, shipping and payment. You can also type a product name (e.g. "nails", "cement") for instant info. Say "Connect to cashier" to chat with our staff. Try: "Where is my order?", "Price of Hammer", "Do you have lumber?", "Connect to cashier".';
    }

    if (custIntent === 'unknown') {
      // Last resort: try treating the whole message as a product search
      const query = message.trim();
      const products = await searchProductsByName(query, 5);
      if (products.length > 0) return products.map((p) => formatProductDetails(p, CUSTOMER_CURRENCY)).join('\n\n');
      const similar = await getSimilarProductsForChat(query, 5);
      const hint = similar.length > 0 ? ` You might be interested in: ${similar.join(', ')}.` : '';
      return `I can help with: order status, product price and availability, shipping and payment — all from our live database. Type a product name or try "Where is my order?", "Price of [product]", "Shipping info". Say "Connect to cashier" to talk to staff.${hint}`;
    }

    return 'I can help with order status, product info, shipping, and payment. Say "Connect to cashier" to speak with our staff.';
  }

  const intent = detectIntent(message);

  if (intent === 'inventory_summary') {
    const inv = await prisma.inventory.findMany({ include: { product: true } });
    const total = inv.reduce((s, i) => s + i.quantity, 0);
    return `We have ${inv.length} products in inventory with a total of ${total} units.`;
  }

  if (intent === 'low_stock' && (role === 'OWNER' || role === 'ADMIN')) {
    const inv = await prisma.inventory.findMany({ include: { product: true } });
    const low = inv.filter((i) => i.quantity <= i.lowStockThreshold);
    if (low.length === 0) return 'No products are currently below the low stock threshold.';
    return `Low stock alert: ${low.length} product(s) below threshold: ${low.map((i) => `${i.product.name} (${i.quantity} left)`).join(', ')}.`;
  }

  if (intent === 'sales_summary' && (role === 'OWNER' || role === 'ADMIN')) {
    const sales = await prisma.saleTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    const total = sales.reduce((s, t) => s + t.total, 0);
    return `Last 30 days: ${sales.length} transactions, total revenue $${total.toFixed(2)}.`;
  }

  if (intent === 'demand_prediction' && (role === 'OWNER' || role === 'ADMIN')) {
    const predictions = await getLatestPredictions(prisma);
    if (predictions.length === 0) return 'No demand predictions available yet. Go to Reports → Demand forecasting & reorder and click "Generate predictions", or use the AI page to run predictive analytics.';
    const top = predictions.slice(0, 5);
    return `Demand forecast (latest): ${top.map((p) => `${p.product.name}: predicted demand ${p.predictedDemand}, suggested restock ${p.suggestedRestock}, risk ${p.riskOfStockout}`).join('; ')}.`;
  }

  if (intent === 'reorder_what' && (role === 'OWNER' || role === 'ADMIN')) {
    const [low, predictions] = await Promise.all([
      prisma.inventory.findMany({ where: {}, include: { product: true } }),
      getLatestPredictions(prisma),
    ]);
    const lowItems = low.filter((i) => i.quantity <= i.lowStockThreshold);
    const predMap = new Map(predictions.map((p) => [p.productId, p]));
    if (lowItems.length === 0) return 'No items are below the low-stock threshold. You can still check Reports → Demand forecasting for suggested restock quantities.';
    const lines = lowItems.map((i) => {
      const pred = predMap.get(i.productId);
      const suggest = pred ? `suggested restock ${pred.suggestedRestock}` : `restock to at least ${i.lowStockThreshold}`;
      return `${i.product.name} (${i.quantity} left, threshold ${i.lowStockThreshold}): ${suggest}`;
    });
    return `Items to reorder (low stock): ${lines.join('. ')}. View Inventory with "Low stock" filter or Reports for full demand forecast.`;
  }

  if (intent === 'sales_forecast' && (role === 'OWNER' || role === 'ADMIN')) {
    const predictions = await getLatestPredictions(prisma);
    const sales = await prisma.saleTransaction.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    const totalRevenue = sales.reduce((s, t) => s + t.total, 0);
    if (predictions.length === 0) return `Sales summary (last 30 days): ${sales.length} transactions, ${totalRevenue.toFixed(2)} total revenue. Run "Generate predictions" in Reports or AI page for demand-based sales forecasting.`;
    const highDemand = predictions.filter((p) => p.predictedDemand > 0).sort((a, b) => b.predictedDemand - a.predictedDemand).slice(0, 5);
    return `Sales forecast: Last 30 days had ${sales.length} transactions (${totalRevenue.toFixed(2)} revenue). Demand-based forecast (next 7 days): ${highDemand.map((p) => `${p.product.name} ~${p.predictedDemand} units`).join(', ')}. See Reports for charts.`;
  }

  if (intent === 'best_selling' && (role === 'OWNER' || role === 'ADMIN')) {
    const items = await prisma.saleItem.findMany({ include: { product: true } });
    const byProduct = new Map<number, { name: string; qty: number }>();
    for (const i of items) {
      const cur = byProduct.get(i.productId);
      const name = i.product.name;
      const qty = (cur?.qty ?? 0) + i.quantity;
      byProduct.set(i.productId, { name, qty });
    }
    const top = [...byProduct.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .map(([, v]) => `${v.name}: ${v.qty} sold`)
      .join(', ');
    return `Best selling products: ${top}.`;
  }

  if (intent === 'product_suggestions') {
    const predictions = await getLatestPredictions(prisma);
    const popular = predictions.filter((p) => p.riskOfStockout === 'LOW' && p.predictedDemand > 0).slice(0, 5);
    if (popular.length === 0) {
      const products = await prisma.product.findMany({ take: 5, include: { inventory: true } });
      return `Product suggestions: ${products.map((p) => p.name).join(', ')}. All in stock.`;
    }
    return `Suggested products (based on demand): ${popular.map((p) => p.product.name).join(', ')}.`;
  }

  if (intent === 'unknown') {
    return "I can help with: demand forecasting, sales forecast, what to reorder, low stock alerts, inventory summary, sales summary, best-selling products, and product suggestions. Try: 'What should I reorder?', 'Demand forecast', 'Sales forecast', or 'Which items are low stock?'";
  }

  return "I don't have access to that data for your role. Try asking about product suggestions or general info.";
}
