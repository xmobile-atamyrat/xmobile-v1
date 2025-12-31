# Postman Collection for Order API

This directory contains Postman collections and environment files for testing the Order/Checkout API.

## Files

- `Order API.postman_collection.json` - Main Postman collection with all API endpoints and workflows
- `Order API.postman_environment.json` - Environment variables for the collection

## Setup Instructions

1. **Import into Postman:**

   - Open Postman
   - Click "Import" button
   - Select both JSON files (collection and environment)
   - Or drag and drop the files into Postman

2. **Select Environment:**

   - In Postman, select "Order API Environment" from the environment dropdown (top right)

3. **Update Base URL (if needed):**
   - The default base URL is `http://localhost:3000`
   - If your server runs on a different port, update the `baseUrl` variable in the environment

## Collection Structure

### 1. Auth - Get Tokens

- **Get User Token** - Authenticates user@test.com and saves token
- **Get Admin Token** - Authenticates admin@test.com and saves token

### 2. User APIs

- **Create Order (Checkout)** - Creates a new order from cart items
- **Get User Orders** - Lists all orders for the authenticated user
- **Get Order by ID** - Gets details of a specific order
- **Cancel Order (User)** - User cancels their own order

### 3. Admin APIs

- **Get All Orders (Admin)** - Lists all orders with filters
- **Get Order by ID (Admin)** - Gets order details with user info
- **Update Order Status (Admin)** - Updates order status
- **Mark Order as Completed (Admin)** - Marks order as completed
- **Cancel Order (Admin)** - Admin cancels an order
- **Update Admin Notes** - Updates admin notes separately

### 4. Workflows

Complete end-to-end scenarios:

#### Scenario 1: Complete Order Flow

1. Get user token
2. Create order (checkout) - Order status: PENDING
3. Get admin token
4. Admin updates status to IN_PROGRESS
5. Admin marks order as COMPLETED

#### Scenario 2: User Cancels Order

1. Get user token
2. Create order
3. User cancels the order - Order status: USER_CANCELLED

#### Scenario 3: Admin Cancels Order

1. Get user token and create order
2. Get admin token
3. Admin cancels the order - Order status: ADMIN_CANCELLED

## Test Credentials

- **User:** user@test.com / Abcd&1234
- **Admin:** admin@test.com / Abcd&1234

## Environment Variables

The collection automatically manages these variables:

- `userToken` - JWT token for user authentication
- `adminToken` - JWT token for admin authentication
- `userId` - User ID (set after login)
- `adminId` - Admin ID (set after login)
- `orderId` - Order ID (set after creating an order)
- `orderNumber` - Order number (set after creating an order)
- `targetStatus` - Target status for status updates

## Running Workflows

1. **Individual Tests:**

   - Run any request individually to test specific endpoints
   - Tokens are automatically saved when you run the auth requests

2. **Complete Workflows:**
   - Use Postman's Collection Runner
   - Select a workflow folder (e.g., "Scenario 1: Complete Order Flow")
   - Click "Run" to execute all requests in sequence
   - The workflow will automatically use saved tokens and order IDs

## Notes

- All requests include automatic token management
- Order IDs are automatically saved after order creation
- Tests verify response structure and status codes
- Console logs show important information during workflow execution
- Make sure your cart has items before testing order creation

## Troubleshooting

1. **401 Unauthorized:**

   - Run "Get User Token" or "Get Admin Token" first
   - Check that tokens are saved in environment variables

2. **400 Bad Request:**

   - Ensure cart has items before creating an order
   - Check request body format matches the schema

3. **404 Not Found:**

   - Verify orderId exists in environment
   - Check baseUrl is correct

4. **500 Server Error:**
   - Check server logs
   - Verify database connection
   - Ensure Prisma migrations are run
