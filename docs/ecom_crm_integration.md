# Ecommerce integration — draft payloads

This is a draft for discussion. Paths and the order status list are proposals.

## Direction

- Category list: ecommerce calls this system (fetch API)
- Brand list: ecommerce calls this system (fetch API)
- Product create / update: webhook from this system to ecommerce
- Price update: webhook from this system to ecommerce
- Stock update: webhook from this system to ecommerce
- Order create: ecommerce calls this system (API)
- Order status: webhook from this system to ecommerce

Product match key is our product id.
Category and brand are loaded with the fetch APIs. A product event still carries the category and brand id and name.
Price fields are on the product event and on a separate price webhook.
total_qty is on the product event and on a separate stock webhook.
Their order number is stored as external_order_no.
The order webhook sends status only.

1. Category list

---

GET /api/ecommerce/categories

Active categories only. parent_id is null for a root category.

{
"data": [
{ "id": 1, "parent_id": null, "name": "Phones" },
{ "id": 2, "parent_id": 1, "name": "Smartphones" }
]
}

2. Brand list

---

GET /api/ecommerce/brands

{
"data": [
{ "id": 4, "name": "Apple" },
{ "id": 5, "name": "Samsung" }
]
}

3. Product create / update

---

Webhook from this system.
Same body for product.created and product.updated.

b2c_source_price_usd is the USD price before the rate is applied.
b2c_price and b2c_discounted_price are TMT.
Lookup names are null when the product has no value for that field.
b2c_discounted_price and b2c_discounted_percentage are null when there is no discount.

{
"event": "product.updated",
"occurred_at": "2026-10-15T12:30:00Z",
"data": {
"id": 1842,
"category_id": 2,
"category": "Smartphones",
"brand_id": 4,
"brand": "Apple",
"name": "iPhone 15 128GB Black",
"model": "A3090",
"color_id": 3,
"color": "Black",
"phone_sim_id": 1,
"phone_sim": "Dual SIM",
"phone_region_id": 2,
"phone_region": "Global",
"phone_activity_id": 1,
"phone_activity": "Active",
"ram": "6 GB",
"storage": "128 GB",
"size": null,
"dimension": null,
"description": "128GB, dual SIM",
"returnable": true,
"b2c_source_price_usd": 799,
"b2c_price": 2800,
"b2c_discounted_price": 2660,
"b2c_discounted_percentage": 5,
"total_qty": 12
}
}

4. Price update

---

Webhook from this system.
Sent when any B2C price field changes.
The same four fields are also included on the product create / update event.

{
"event": "product.price_updated",
"occurred_at": "2026-10-15T12:31:00Z",
"data": {
"id": 1842,
"b2c_source_price_usd": 799,
"b2c_price": 2800,
"b2c_discounted_price": 2660,
"b2c_discounted_percentage": 5
}
}

5. Stock update

---

Webhook from this system.
Sent when total_qty changes.

{
"event": "product.stock_updated",
"occurred_at": "2026-10-15T12:32:00Z",
"data": {
"id": 1842,
"total_qty": 11
}
}

6. Order create

---

API call from ecommerce into this system.

POST /api/ecommerce/orders

external_order_no is their order number. We store it and treat it as unique.
price is the TMT unit price they charged.
We create the order as pending and do not take payment on this call.

{
"external_order_no": "WEB-100245",
"name": "Aman Atayev",
"phone": "+99361234567",
"email": "aman@example.com",
"products": [
{ "product_id": 1842, "quantity": 1, "price": 2660 },
{ "product_id": 2201, "quantity": 2, "price": 150 }
]
}

Response:

{
"data": {
"id": 9001,
"external_order_no": "WEB-100245",
"status": "pending"
}
}

A repeat of the same external_order_no returns the order already stored.

7. Order status

---

Webhook from this system. Status only.

{
"event": "order.status_updated",
"occurred_at": "2026-10-15T14:00:00Z",
"data": {
"id": 9001,
"external_order_no": "WEB-100245",
"status": "paid"
}
}

Proposed statuses:

- pending
- paid
- completed
- cancelled
- partially_returned
- returned
