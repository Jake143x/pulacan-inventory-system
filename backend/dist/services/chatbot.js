import { getLatestPredictions } from './aiAnalytics.js';
import { createNotificationForCashiers } from './notifications.js';
import { prisma } from '../lib/prisma.js';
const CASHIER_CURRENCY = '₱';
const CUSTOMER_CURRENCY = '₱';
function detectCustomerIntent(message) {
    const lower = message.toLowerCase().trim();
    const trimmed = message.trim();
    if (/connect\s+to\s+(?:cashier|staff|agent)/.test(lower) ||
        /talk\s+to\s+(?:a\s+)?cashier/.test(lower) ||
        /speak\s+to\s+(?:cashier|staff)/.test(lower) ||
        /(?:need|want)\s+(?:to\s+)?(?:talk|speak)\s+to/.test(lower) ||
        /customer\s+support|live\s+agent|real\s+person|human\s+help/.test(lower) ||
        lower === 'connect to cashier' ||
        lower === 'talk to cashier')
        return { intent: 'connect_to_cashier' };
    if (/\b(?:where is|status of|track)\s+my\s+order/.test(lower) || /\bmy\s+orders?\b/.test(lower) || /\border\s+status\b/.test(lower))
        return { intent: 'order_status' };
    const priceMatch = lower.match(/(?:price|how much|cost)\s+(?:of\s+)?(.+)/);
    if (priceMatch)
        return { intent: 'product_price', productQuery: priceMatch[1].trim() };
    const stockMatch = lower.match(/(?:stock|availability|in stock|do you have)\s+(?:for\s+)?(.+)/);
    if (stockMatch)
        return { intent: 'product_stock', productQuery: stockMatch[1].trim() };
    if (/\bshipping\b|\bdelivery\b|\bdeliver\b/.test(lower))
        return { intent: 'shipping_info' };
    if (/\bpayment\b|\bpay\b|\bgcash\b|\bcod\b|\bdebit\b/.test(lower))
        return { intent: 'payment_options' };
    if (/\bhelp\b/.test(lower) || /\bwhat\s+can\s+you\b/.test(lower))
        return { intent: 'customer_help' };
    if (trimmed.length > 0 && trimmed.length < 80)
        return { intent: 'product_price', productQuery: trimmed };
    return { intent: 'unknown' };
}
function detectCashierIntent(message) {
    const lower = message.toLowerCase().trim();
    const stockMatch = lower.match(/(?:stock|check stock|how many)\s+(?:for\s+)?(.+)/);
    if (stockMatch)
        return { intent: 'stock_product', productQuery: stockMatch[1].trim() };
    const priceMatch = lower.match(/(?:price|how much|cost)\s+(?:of\s+)?(.+)/);
    if (priceMatch)
        return { intent: 'price_product', productQuery: priceMatch[1].trim() };
    if (/\b(?:add|put)\s+(?:item|product|\d+)/.test(lower) || /\badd\s+to\s+(?:sale|transaction|cart)/.test(lower))
        return { intent: 'add_item' };
    if (/\b(?:apply|give|add)\s*(?:\d+%?)?\s*discount/.test(lower) || /\bdiscount\b/.test(lower))
        return { intent: 'discount' };
    if (/\b(?:print\s+)?receipt\b/.test(lower))
        return { intent: 'receipt' };
    if (/\breturn(s)?\b/.test(lower) || /\bprocess\s+return/.test(lower))
        return { intent: 'return' };
    if (/\bhelp\b/.test(lower) || /\bwhat\s+can\s+you\b/.test(lower))
        return { intent: 'help' };
    return { intent: 'unknown' };
}
function detectIntent(message) {
    const lower = message.toLowerCase().trim();
    if (/\b(inventory|stock|products?)\b/.test(lower) && (/\b(low|alert|threshold)\b/.test(lower) || /\bhow many\b/.test(lower)))
        return 'low_stock';
    if (/\b(reorder|what (should|to) reorder|what to order|reorder list)\b/.test(lower))
        return 'reorder_what';
    if (/\b(sales? ?forecast|demand forecast|forecast sales|sales prediction)\b/.test(lower))
        return 'sales_forecast';
    if (/\b(inventory|stock)\b/.test(lower) && !/\b(low|alert)\b/.test(lower))
        return 'inventory_summary';
    if (/\b(sales?|revenue)\b/.test(lower))
        return 'sales_summary';
    if (/\b(demand|predict|forecast|restock)\b/.test(lower))
        return 'demand_prediction';
    if (/\b(best selling|top products?)\b/.test(lower))
        return 'best_selling';
    if (/\b(suggest|recommend|what (to )?buy)\b/.test(lower))
        return 'product_suggestions';
    return 'unknown';
}
export async function chat(userId, message, role) {
    // ——— Cashier: POS Chat Assistant — short, actionable, no analytics ———
    if (role === 'CASHIER') {
        const { intent: cashierIntent, productQuery } = detectCashierIntent(message);
        if (cashierIntent === 'stock_product' && productQuery) {
            const products = await prisma.product.findMany({
                where: { name: { contains: productQuery, mode: 'insensitive' } },
                include: { inventory: true },
                take: 5,
            });
            if (products.length === 0)
                return 'Product not found. Please check the name or try another search.';
            const line = products
                .map((p) => {
                const qty = p.inventory?.quantity ?? 0;
                const status = qty === 0 ? 'Out of Stock' : qty <= (p.inventory?.lowStockThreshold ?? 10) ? 'Low Stock' : 'In Stock';
                return `${p.name} – ${qty} units available. Status: ${status}.`;
            })
                .join('\n');
            return line;
        }
        if (cashierIntent === 'price_product' && productQuery) {
            const products = await prisma.product.findMany({
                where: { name: { contains: productQuery, mode: 'insensitive' } },
                take: 5,
            });
            if (products.length === 0)
                return 'Product not found. Please check the name or try another search.';
            const line = products.map((p) => `${p.name} – ${CASHIER_CURRENCY}${p.unitPrice.toFixed(2)}`).join('\n');
            return line;
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
            const products = await prisma.product.findMany({
                where: { name: { contains: trimmed, mode: 'insensitive' } },
                include: { inventory: true },
                take: 3,
            });
            if (products.length === 1) {
                const p = products[0];
                const qty = p.inventory?.quantity ?? 0;
                const status = qty === 0 ? 'Out of Stock' : qty <= (p.inventory?.lowStockThreshold ?? 10) ? 'Low Stock' : 'In Stock';
                return `${p.name} – ${qty} units available. Status: ${status}. Price: ${CASHIER_CURRENCY}${p.unitPrice.toFixed(2)}.`;
            }
            if (products.length > 1) {
                return products.map((p) => `${p.name} – ${p.inventory?.quantity ?? 0} units. ${CASHIER_CURRENCY}${p.unitPrice.toFixed(2)}.`).join('\n');
            }
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
            await createNotificationForCashiers(prisma, 'Customer inquiry', `${name} (${email}) is requesting to connect to a cashier for assistance.`, 'CUSTOMER_INQUIRY');
            return "Your request has been sent. A cashier will assist you shortly. You can also visit our store or call us for immediate help.";
        }
        if (custIntent === 'order_status') {
            const orders = await prisma.onlineOrder.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { items: { include: { product: true } } },
            });
            if (orders.length === 0)
                return "You don't have any orders yet. Place an order from your cart to see status here.";
            const lines = orders.map((o) => `Order #${o.id}: ${o.status} – Total ${CUSTOMER_CURRENCY}${o.total.toFixed(2)} (${o.createdAt.toISOString().slice(0, 10)}).`);
            return `Your recent orders:\n${lines.join('\n')}\n\nCheck "My Orders" in the menu for full details.`;
        }
        if (custIntent === 'product_price' && productQuery) {
            const products = await prisma.product.findMany({
                where: { name: { contains: productQuery, mode: 'insensitive' } },
                take: 5,
            });
            if (products.length === 0)
                return `No product found for "${productQuery}". Try browsing our Products page.`;
            return products.map((p) => `${p.name} – ${CUSTOMER_CURRENCY}${p.unitPrice.toFixed(2)}`).join('\n');
        }
        if (custIntent === 'product_stock' && productQuery) {
            const products = await prisma.product.findMany({
                where: { name: { contains: productQuery, mode: 'insensitive' } },
                include: { inventory: true },
                take: 5,
            });
            if (products.length === 0)
                return `No product found for "${productQuery}". Try browsing our Products page.`;
            const line = products
                .map((p) => {
                const qty = p.inventory?.quantity ?? 0;
                const status = qty === 0 ? 'Out of stock' : qty <= (p.inventory?.lowStockThreshold ?? 10) ? 'Low stock' : 'In stock';
                return `${p.name} – ${status} (${qty} available). ${CUSTOMER_CURRENCY}${p.unitPrice.toFixed(2)}`;
            })
                .join('\n');
            return line;
        }
        if (custIntent === 'shipping_info') {
            return 'We offer delivery. Shipping is ₱150 per order; free shipping on orders ₱2,000 and above. Enter your address at checkout. For bulk or special delivery, connect to a cashier.';
        }
        if (custIntent === 'payment_options') {
            return 'We accept: GCash, Debit Card, and Cash on Delivery. Choose your preferred method at checkout. For other options, connect to a cashier.';
        }
        if (custIntent === 'customer_help') {
            return 'I can help with: order status, product price and availability, shipping and payment info. You can also request to connect to a cashier for personal assistance. Try: "Where is my order?", "Price of Hammer", "Connect to cashier".';
        }
        if (custIntent === 'unknown') {
            return 'I can help with: order status, product price and availability, shipping and payment. Say "Connect to cashier" to get help from our staff. Try: "Where is my order?", "Price of Common Nails", "Shipping info".';
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
        if (low.length === 0)
            return 'No products are currently below the low stock threshold.';
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
        if (predictions.length === 0)
            return 'No demand predictions available yet. Go to Reports → Demand forecasting & reorder and click "Generate predictions", or use the AI page to run predictive analytics.';
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
        if (lowItems.length === 0)
            return 'No items are below the low-stock threshold. You can still check Reports → Demand forecasting for suggested restock quantities.';
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
        if (predictions.length === 0)
            return `Sales summary (last 30 days): ${sales.length} transactions, ${totalRevenue.toFixed(2)} total revenue. Run "Generate predictions" in Reports or AI page for demand-based sales forecasting.`;
        const highDemand = predictions.filter((p) => p.predictedDemand > 0).sort((a, b) => b.predictedDemand - a.predictedDemand).slice(0, 5);
        return `Sales forecast: Last 30 days had ${sales.length} transactions (${totalRevenue.toFixed(2)} revenue). Demand-based forecast (next 7 days): ${highDemand.map((p) => `${p.product.name} ~${p.predictedDemand} units`).join(', ')}. See Reports for charts.`;
    }
    if (intent === 'best_selling' && (role === 'OWNER' || role === 'ADMIN')) {
        const items = await prisma.saleItem.findMany({ include: { product: true } });
        const byProduct = new Map();
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
